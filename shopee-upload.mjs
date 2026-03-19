import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

dotenv.config();
chromium.use(StealthPlugin());

// ==========================================
// CONFIGURAÇÃO DAS LOJAS SHOPEE (Mesmas do scraper)
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
        email: "EMAIL_LOJA_2@gmail.com",
        password: "SENHA_LOJA_2",
        sessionFile: "shopee-session-loja2.json"
    },
    { 
        id: "Loja Terceira", 
        email: "EMAIL_LOJA_3@gmail.com",
        password: "SENHA_LOJA_3",
        sessionFile: "shopee-session-loja3.json"
    }
];

function prompt(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

async function downloadOrConvertImage(src) {
    const tmpDir = os.tmpdir();
    const fileName = `shopee_upload_${crypto.randomBytes(4).toString('hex')}.png`;
    const dest = path.join(tmpDir, fileName);

    if (src.startsWith('data:')) {
        const base64Data = src.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(dest, base64Data, 'base64');
    } else {
        const response = await fetch(src);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(buffer));
    }
    return dest;
}

(async () => {
    console.log("🚀 Iniciando Bot Interativo de Criação de Produto na Shopee...");
    const browser = await chromium.launch({ headless: false }); // Navegador visível para você interagir
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1. Abrir Vercel (Gerador de Imagens)
    console.log("==========================================================================");
    console.log("🌐 Abrindo seu portal (Image Generator)...");
    await page.goto('https://gk-3d-parts-vault.vercel.app/image-generator', { waitUntil: 'domcontentloaded' });
    
    console.log("👨‍💻 AÇÃO NECESSÁRIA NO NAVEGADOR!");
    console.log("1. Faça a identificação do seu produto, gere as cores, ambientes e o texto da Shopee.");
    console.log("2. Verifique se o resultado ficou bom na tela do navegador do bot.");
    console.log("3. DEPOIS de tudo renderizado na tela, volte aqui e aperte a tecla ENTER.");
    console.log("==========================================================================");
    
    await prompt("▶️ Pressione ENTER para Extrair e avançar: ");

    // 2. Extrair dados da Vercel
    console.log("\n🔍 Escaneando a página em busca do Título, Descrição e Imagens geradas...");
    const extractedData = await page.evaluate(() => {
        let title = "";
        let desc = "";
        
        // Extrai Título
        const labels = Array.from(document.querySelectorAll('label'));
        const labelTitle = labels.find(l => l.innerText.includes('Título ('));
        if (labelTitle && labelTitle.nextElementSibling) {
            const p = labelTitle.nextElementSibling.querySelector('p');
            if (p) title = p.innerText.trim();
        }
        
        // Extrai Descrição
        const labelDesc = labels.find(l => l.innerText.includes('Descrição ('));
        if (labelDesc && labelDesc.nextElementSibling) {
            const pre = labelDesc.nextElementSibling.querySelector('pre');
            if (pre) desc = pre.innerText.trim();
        }
        
        // Extrai Imagens de Ambiente & Benefícios (Ignorando as 'Cores' a pedido do usuário)
        const marketingImages = [];
        const elements = document.querySelectorAll('.group.relative.rounded-lg');
        elements.forEach(el => {
            const text = el.innerText;
            if (text.includes("Ambiente") || text.includes("Benefício")) {
                const img = el.querySelector('img');
                if (img && img.src) {
                    marketingImages.push(img.src);
                }
            }
        });

        return { title, desc, images: marketingImages };
    });

    console.log(`\n📋 RESUMO EXTRAÍDO:`);
    console.log(`- Título: ${extractedData.title || 'NÃO ENCONTRADO'}`);
    console.log(`- Imagens (Apenas Ambientes e Benefícios): ${extractedData.images.length} capturadas`);
    
    if (extractedData.images.length === 0) {
        console.log("⚠️ ATENÇÃO: Nenhuma imagem promocional (Ambiente ou Benefício) foi encontrada na tela. O bot vai subir sem elas.");
    }

    // 3. Escolher Loja da Shopee
    console.log("\n==========================================================================");
    console.log("🛒 ESCOLHA EM QUAL LOJA DA SHOPEE DESEJA SUBIR ESTE PRODUTO:");
    SHOPEE_STORES.forEach((store, index) => {
        console.log(`[${index + 1}] - ${store.id} (${store.email})`);
    });
    
    let storeIndexStr = "";
    while(true) {
         storeIndexStr = await prompt("▶️ Digite o NÚMERO da loja escolhida (ex: 1): ");
         if (parseInt(storeIndexStr) > 0 && parseInt(storeIndexStr) <= SHOPEE_STORES.length) break;
         console.log("Número inválido. Tente novamente.");
    }
    
    const storeIndex = parseInt(storeIndexStr) - 1;
    const store = SHOPEE_STORES[storeIndex];
    console.log(`👉 Loja escolhida: ${store.id}`);

    // Contexto com Sessão Guardada se existir (evitar fazer login todo dia)
    const hasSession = fs.existsSync(store.sessionFile);
    const shopeeContext = hasSession 
        ? await browser.newContext({ storageState: store.sessionFile })
        : await browser.newContext();

    const shopeePage = await shopeeContext.newPage();
    console.log(`\n☁️ Acessando Painel de Criação de Produto da Shopee...`);
    await shopeePage.goto('https://seller.shopee.com.br/portal/product/new?pageEntry=product_list', { waitUntil: 'domcontentloaded' });
    
    // Tratamento de Login & OTP
    await shopeePage.waitForTimeout(3000);
    const urlAtual = shopeePage.url();
    if (urlAtual.includes('signin') || urlAtual.includes('login') || urlAtual.includes('verify')) {
        console.log(`\n🔑 Bloqueio de Login detectado! O bot preencherá o e-mail e a senha...`);
        try {
            const elEmail = await shopeePage.$('input[name="loginKey"], input[type="text"], input[placeholder*="Email"]');
            if(elEmail) { await elEmail.fill(store.email); } 
            
            const elSenha = await shopeePage.$('input[name="password"], input[type="password"]');
            if(elSenha) { await elSenha.fill(store.password); } 
            
            await shopeePage.waitForTimeout(1000);
            await shopeePage.keyboard.press('Enter');
        } catch(e) {}

        console.log("\n==========================================================================");
        console.log("⚠️ AÇÃO NECESSÁRIA NO NAVEGADOR (VERIFICAÇÃO DE EMAIL / SMS):");
        console.log("A Shopee pediu verificação de segurança. Aprove no seu App ou pegue o código de Email!");
        console.log("O bot está em PAUSA MÁGICA, esperando você entrar no site e a página do produto carregar...");
        console.log("==========================================================================\n");
        
        let verificando = true;
        while(verificando) {
            try {
                const u = shopeePage.url();
                if(!u.includes('signin') && !u.includes('verify') && !u.includes('login') && u.includes('portal/product/new')) {
                    verificando = false; 
                }
            } catch (e) { }
            await shopeePage.waitForTimeout(2000);
        }
        
        console.log("\n✅ Login e Verificação concluídos com sucesso! Guardando esta sessão para o futuro...");
        await shopeePage.waitForTimeout(5000); // Dá tempo do SPA do painel carregar inteiro
        await shopeeContext.storageState({ path: store.sessionFile });
    }

    // 4. Transformar Imagens DataURL para Arquivos Locais Temporários para Upload
    const localFilePaths = [];
    if (extractedData.images.length > 0) {
        console.log("\n📥 Transformando as imagens extraídas da Vercel para subir na Shopee...");
        for (const src of extractedData.images) {
            try {
                const p = await downloadOrConvertImage(src);
                localFilePaths.push(p);
            } catch(e) {
                console.log("Aviso: Falha ao baixar uma das imagens.", e.message);
            }
        }
    }

    // 5. Automação do Preenchimento na Shopee (Imagens e Nome)
    console.log("🛠️ Injetando arquivos de Imagem e preenchendo o formulário...");
    
    // As injeções da Shopee demoram um pouco a renderizar
    await shopeePage.waitForTimeout(3000);

    // Faz upload das imagens (Até o limite de 9 se houver)
    if (localFilePaths.length > 0) {
        try {
             const fileInput = await shopeePage.$('input[type="file"][accept*="image"]');
             if (fileInput) {
                 await fileInput.setInputFiles(localFilePaths.slice(0, 9));
                 console.log("✅ Imagens enviadas para o painel da Shopee!");
             } else {
                 console.log("❌ O bot não encontrou o input de imagem exato ('input[type=file]').");
             }
        } catch (e) {
             console.log("❌ Erro ao tentar subir fotos automaticamente:", e.message);
        }
    }

    // Tentar preencher Titulo (Shopee usa input text na primeira section)
    if (extractedData.title) {
        try {
            // Em Vue, os components geralmente tem placeholder="Nome do produto"
            const nomeInput = await shopeePage.$('input[placeholder*="Nome"], input[placeholder*="Produto"]');
            if (nomeInput) {
                await nomeInput.fill(extractedData.title);
                console.log("✅ Título do produto preenchido.");
            } else {
                console.log("⚠️ O Título do produto não pôde ser injetado pois o input mudou de id/classe, tente colar manualmente.");
            }
        } catch(e) { console.log(e.message); }
    }

    // Tentar preencher Descrição (Shopee usa textarea ou rich text div)
    if (extractedData.desc) {
         try {
             // A descrição geralmente está em um textarea
             const descInput = await shopeePage.$('textarea, [contenteditable="true"]');
             if (descInput) {
                 await descInput.fill(extractedData.desc);
                 console.log("✅ Descrição preenchida!");
             } else {
                 console.log("⚠️ A Descrição não pôde ser pré-preenchida, tente colar manualmente.");
             }
         } catch(e){ console.log(e.message); }
    }

    // PAUSA CONFORME PEDIDO "faça até ai depois continuamos"
    console.log("\n==========================================================================");
    console.log("🎉 SUCESSO! O Bot chegou até a tela da criação com as imagens e nome engatilhados.");
    console.log("Continue editando seu anúncio no navegador ou feche o navegador quando tiver terminado e feche aqui (Ctrl+c).");
    console.log("Até a próxima ordem!");
    console.log("==========================================================================");
    
})();
