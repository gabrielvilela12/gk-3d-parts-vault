import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';

// Carrega as chaves do seu arquivo .env
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Cria a conexão com seu banco de dados em produção!
const supabase = createClient(supabaseUrl, supabaseKey);

// Adiciona o plugin "Stealth" (Furtivo) que engana a segurança do Google/Shopee!
chromium.use(StealthPlugin());

// ==========================================
// CONFIGURAÇÃO DAS LOJAS SHOPEE (LOOP: 3 LOJAS)
// ==========================================
const SHOPEE_STORES = [
    { 
        id: "Loja Principal", 
        email: "impressoragk@gmail.com", 
        password: "Impressoragk3D",
        sessionFile: "shopee-session-loja1.json"
    },
    { 
        id: "Loja Secundária", 
        email: "EMAIL_LOJA_2@gmail.com", // << OBTENHA SEUS ACESSOS E SUBSTITUA
        password: "SENHA_LOJA_2",        // << OBTENHA SEUS ACESSOS E SUBSTITUA
        sessionFile: "shopee-session-loja2.json"
    },
    { 
        id: "Loja Terceira", 
        email: "EMAIL_LOJA_3@gmail.com", // << OBTENHA SEUS ACESSOS E SUBSTITUA
        password: "SENHA_LOJA_3",        // << OBTENHA SEUS ACESSOS E SUBSTITUA
        sessionFile: "shopee-session-loja3.json"
    }
];

let isRunning = false;

// -----------------------------------------------------------------
// FUNÇÃO CENTRAL DO ROBÔ (Extrai e Salva POR LOJA)
// -----------------------------------------------------------------
async function runBotForStore(store) {
    console.log(`\n\n🟢 [${store.id}] Lançando o Navegador Invisível para a conta: ${store.email} ...`);
    const hasSession = fs.existsSync(store.sessionFile);
    
    // Deixamos sem o executablePath p/ o bot funcionar em qualquer Servidor Linux de Produção (sem Opera)!
    // Ele usará o Chromium Stealth interno nativo perfeitamente e sem crashar a nuvem.
    const browser = await chromium.launch({
        headless: hasSession, // Rodará 100% debaixo dos panos (invisível) se o arquivo da sessão existir!
    });
    
    let context;
    if (hasSession) {
        global.currentStatusMessage = `[${store.id}] Restaurando sessão invisível...`;
        context = await browser.newContext({ storageState: store.sessionFile });
    } else {
        global.currentStatusMessage = `[${store.id}] Atenção: Login manual necessário na janela...`;
        console.log(`⚠️ ATENÇÃO [${store.id}]: Nenhuma sessão salva. Uma janela vai abrir no Servidor para você realizar o Primeiro Login!`);
        context = await browser.newContext();
    }
    
    const page = await context.newPage();
    let pedidosRetornados = []; // onde vamos guardar o que rasparmos

    try {
        console.log(`🌐 [${store.id}] Acessando Shopee Seller Center...`);
        global.currentStatusMessage = `[${store.id}] Acessando o portal da Shopee...`;
        await page.goto('https://seller.shopee.com.br/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        const currentUrl = page.url();
        // Acesso negado ou Sessão nova -> Vai rolar Login Automático
        if (currentUrl.includes('signin') || currentUrl.includes('login') || currentUrl.includes('verify') || currentUrl.includes('email-link') || !hasSession) {
            console.log(`\n🔑 [${store.id}] A API ESTÁ PREENCHENDO O LOGIN...`);
            if (currentUrl.includes('signin') || currentUrl.includes('login')) {
                try {
                    const elEmail = await page.$('input[name="loginKey"], input[type="text"], input[placeholder*="Email"]');
                    if(elEmail) { await elEmail.fill(store.email); } 
                    else { await page.keyboard.type(store.email); await page.keyboard.press('Tab'); }
                    
                    const elSenha = await page.$('input[name="password"], input[type="password"]');
                    if(elSenha) { await elSenha.fill(store.password); } 
                    else { await page.keyboard.type(store.password); }
                    
                    await page.waitForTimeout(1000);
                    await page.keyboard.press('Enter');
                } catch(e) {}
            }

            console.log("\n=======================================================");
            console.log("⚠️ APROVE O LOGIN NO SEU CELULAR / APLICATIVO DA SHOPEE!");
            console.log("A Requisição (API) está esperando essa janela fechar para devolver");
            console.log("os dados ao seu Front-End. O robô vai aguardar...");
            console.log("=======================================================\n");
            
            // Loop para ver se o dono liberou o acesso
            let aguardando = true;
            let counterTime = 0;
            while(aguardando) {
                try {
                    const urlAtual = page.url();
                    // Detecta se saiu de toda a teia de senha da shopee
                    if(!urlAtual.includes('signin') && !urlAtual.includes('verify') && !urlAtual.includes('login') && !urlAtual.includes('email-link')) {
                        aguardando = false; 
                    } else {
                        counterTime++;
                        global.currentStatusMessage = `[${store.id}] AÇÃO NECESSÁRIA: Confira seu Email/App Shopee para aprovar o login! (${counterTime}s)`;
                    }
                } catch (e) { }
                await new Promise(r => setTimeout(r, 1000));
            }
            
            console.log("⏳ Painel de lojista detectado! Aguardando 5 segundos para blindar a sessão...");
            await page.waitForTimeout(5000);
            
            console.log(`✅ [${store.id}] Logado com sucesso! Sessão registrada para os próximos Fills invisíveis!`);
            await context.storageState({ path: store.sessionFile });
        } 
        
        // Daqui pra frente acessamos a pagina dos pedidos direitinho
        // Vamos iterar nas duas abas filhas de "Para Enviar" (Para Processar e Processado) para garantir 100% de captura sem bugar o SPA da Shopee
        const abasEnvio = [
            "https://seller.shopee.com.br/portal/sale/order?type=toship&source=to_process",
            "https://seller.shopee.com.br/portal/sale/order?type=toship&source=processed"
        ];
        
        let allStorePedidos = [];
        
        for (const urlEnvio of abasEnvio) {
            const isProcessedTab = urlEnvio.includes('source=processed');
            console.log(`\n📦 [${store.id}] Buscando aba: ${isProcessedTab ? 'Processado' : 'Para Processar'}...`);
            global.currentStatusMessage = `[${store.id}] Acessando aba ${isProcessedTab ? 'Processados' : 'Para Processar'}...`;
            
            await page.goto(urlEnvio, { waitUntil: 'domcontentloaded' });
            
            console.log("⏳ Forçando uma espera na tabela (8s) contra os bloqueios...");
            await page.waitForTimeout(8000); 
            
            // Verificação Crítica: Shopee barrando o acesso ou sessão expirada?
            if (page.url().includes('login') || page.url().includes('signin')) {
                throw new Error("Sessão expirada. A Shopee bloqueou o acesso aos pedidos e exigiu login novamente.");
            }
            
            global.currentStatusMessage = `[${store.id}] Escaneando tela de pedidos (${isProcessedTab ? 'Processados' : 'A Processar'})...`;
            console.log("🔍 Escaneando DOM e rastreando Imagens (Método Anti-Design-Change Inteligente)...");
            
            const pedidosAba = await page.evaluate(() => {
                const regexOrderId = /(2[3-9][0-1][0-9][0-3][0-9][A-Z0-9]{8,15})/;
                
                // Pega todos os nós finais (folhas) que contenham texto e passem no Regex de Pedido
                const allElements = Array.from(document.querySelectorAll('*'));
                const leafNodes = allElements.filter(el => {
                    return el.children.length === 0 && el.textContent && regexOrderId.test(el.textContent);
                });
                
                const results = [];
                const seenIds = new Set();
                
                for (const node of leafNodes) {
                    const match = node.textContent.match(regexOrderId);
                    if (!match) continue;
                    const orderId = match[1];
                    
                    if (seenIds.has(orderId)) continue;
                    seenIds.add(orderId);
                    
                    // Sobe até achar um container que contenha preço e imagem (Garante que é o Card de Pedido)
                    let container = node;
                    for(let i=0; i < 15; i++) {
                        if (container.parentElement && container.parentElement.tagName !== 'BODY') {
                            container = container.parentElement;
                            // Checa se engloba pelo menos uma imagem e tem um texto de Real (R$)
                            if (container.querySelector('img') && container.innerText.includes('R$')) {
                                // Sobe +1 nível para garantir que abraçou a div delimitadora
                                if (container.parentElement) container = container.parentElement;
                                break;
                            }
                        }
                    }
                    
                    // Extração da Imagem (Excluindo ícones de loja e avatares)
                    const imgs = Array.from(container.querySelectorAll('img'));
                    let shopeeImage = "";
                    for (const img of imgs) {
                        const src = img.src || "";
                        if (src.includes('file/') || src.includes('susercontent')) {
                            if (!src.includes('avatar') && !src.includes('icon') && !src.includes('portrait')) {
                                shopeeImage = src;
                                break;
                            }
                        }
                    }
                    if (!shopeeImage && imgs.length > 0) shopeeImage = imgs[0].src;
                    
                    // Extração do Texto Completo SEM truncamento (ignorando CSS ellipsis '...')
                    const leafTexts = [];
                    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
                    let textNode;
                    while ((textNode = walker.nextNode())) {
                        const txt = textNode.nodeValue.trim();
                        if (txt.length > 0) leafTexts.push(txt);
                    }
                    let chunk = leafTexts.join(' | '); 
                    
                    const valMatch = chunk.match(/R\$\s?([\d\.,]+)/);
                    let totalAmount = 0;
                    if (valMatch) {
                        totalAmount = parseFloat(valMatch[1].replace(/\./g, '').replace(',', '.'));
                    }
                    
                    results.push({
                        ExternalOrderId: orderId,
                        Status: 'A Enviar (Para Processar)',
                        CustomerName: 'Consulte o Payload',
                        TotalAmount: totalAmount,
                        ProductSummary: 'Veja o Payload',
                        RawText: chunk,
                        shopeeImageUrl: shopeeImage || null,
                        CapturedAt: new Date().toISOString()
                    });
                }
                return results;
            });
            allStorePedidos = allStorePedidos.concat(pedidosAba);
        }
        
        // Remove duplicatas caso ocorram entre categorias
        const mapPedidos = new Map();
        for (const p of allStorePedidos) {
            mapPedidos.set(p.ExternalOrderId, p);
        }
        const pedidosRetornados = Array.from(mapPedidos.values());
        
        console.log(`📋 SUCESSO [${store.id}]! Foi encontrado um total de ${pedidosRetornados.length} pedido(s) pendentes nesta loja.`);
        
    } catch (e) {
        console.log(`⚠️ [${store.id}] A extração falhou por um erro crítico inesperado.`);
        console.log("Erro Técnico:", e.message);
        throw new Error(`[${store.id}] Falha na extração: ${e.message}`);
    } finally {
        console.log(`👋 [${store.id}] Destruindo Instância e Fechando Engine...`);
        global.currentStatusMessage = `[${store.id}] Fechando navegador invisível...`;
        await browser.close();
    }
    
    return pedidosRetornados;
}


// -----------------------------------------------------------------
// SERVIDOR WEB (Mini-Nuvem Pessoal - API REST)
// -----------------------------------------------------------------
const app = express();
app.use(cors()); // Aceita requests de qualquer site (Vercel)
app.use(express.json());

global.currentStatusMessage = "Aguardando fila de lojas...";

app.get('/api/scrape/status', (req, res) => {
    res.json({ message: global.currentStatusMessage, isRunning: isRunning });
});

app.all('/api/scrape', async (req, res) => {
    // Esse é a Trava de Segurança Ouro:
    // Se várias pessoas clicarem no seu site no mesmo segundo, o bot não trava o seu pc criando 50 janelas!
    if (isRunning) {
        return res.status(429).json({ 
            success: false, 
            message: "O Servidor já está raspando a Shopee neste exato momento por outro comando. Aguarde e confira o painel." 
        });
    }
    
    isRunning = true;
    try {
        console.log(`\n=======================================================`);
        console.log(`🌐 [${new Date().toLocaleTimeString()}] REQUISIÇÃO DO FRONT-END! Iniciando LOOP em massa das 3 LOJAS...`);
        console.log(`=======================================================\n`);
        
        let todosMassa = [];
        let executionLogs = [];
        
        // Usa as lojas enviadas pelo React (Banco Supabase) ou cai nas fixadas do código
        const injectedStores = req.body && req.body.stores ? req.body.stores : SHOPEE_STORES;
        console.log(`📌 Lojas identificadas para rodar o bot: ${injectedStores.length}`);
        
        for (const store of injectedStores) {
            if (!store.email || store.email.includes('EMAIL_LOJA_')) {
                console.log(`⏭️ [${store.id}] Pulando a loja porque as credenciais não foram preenchidas no código.`);
                executionLogs.push(`[${store.id}] Ignorada: Email e Senha em branco.`);
                continue;
            }
            
            try {
                const pedidosLoja = await runBotForStore(store);
                if (pedidosLoja && pedidosLoja.length > 0) {
                   todosMassa = todosMassa.concat(pedidosLoja);
                   executionLogs.push(`[${store.id}]: Encontrados ${pedidosLoja.length} envios.`);
                } else {
                   executionLogs.push(`[${store.id}]: Limpo. Sem envios pendentes.`);
                }
            } catch (fail) {
                console.error(`Erro isolado ao tentar raspar ${store.id}:`, fail.message);
                executionLogs.push(`[${store.id}]: FALHA -> ${fail.message}`);
                global.currentStatusMessage = `[${store.id}] Ignorada com Erro Crítico. Próxima loja...`;
            }
        }
        
        // Sincroniza O LOTE GIGANTE das 3 lojas no Supabase ao mesmo tempo
        if (todosMassa.length > 0) {
           fs.writeFileSync('pedidos-aenviar.json', JSON.stringify(todosMassa, null, 2), 'utf8');
           try {
               console.log("\n☁️ BATCH API: Postando o LOTE de TODAS as lojas no Supabase...");
               const { error } = await supabase.from('shopee_orders').upsert(todosMassa, { onConflict: 'ExternalOrderId' }); 
               if (error) console.log("❌ Erro na Inserção Lote:", error.message);
               else console.log("✅ Lote Gigante Supabase Sincronizado com Sucesso!");
           } catch(e) { console.error("❌ Batch DB Falhou:", e.message); }
        }
        
        // Devolve pro React lá na Vercel o Status Code 200 de sucesso
        res.status(200).json({
            success: true,
            totalPedidos: todosMassa.length,
            message: todosMassa.length > 0 ? "Loop nas 3 Lojas concluído com sucesso!" : "Nenhum pedido encontrado em nenhuma das 3 lojas hoje.",
            pedidos: todosMassa,
            logs: executionLogs
        });
        
    } catch (e) {
        res.status(500).json({ 
            success: false, 
            error: "Falha crítica ao operar o robô em massa", 
            details: e.message 
        });
    } finally {
        isRunning = false;
    }
});

const PORT = 3001; // A sua React App usa a 3000 ou 5173, usamos a 3001 para a API
app.listen(PORT, () => {
    console.log(`\n=======================================================`);
    console.log(`🔥 A SUA API ON-DEMAND DA SHOPEE ESTÁ ONLINE (SEM CRON)! 🔥`);
    console.log(`📍 Acilho o gatilho batendo na porta: => GET http://localhost:${PORT}/api/scrape`);
    console.log(`=======================================================\n`);
});
