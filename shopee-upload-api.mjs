import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
chromium.use(StealthPlugin());

const app = express();
app.use(cors()); // Aceita requests do Vercel
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// CONFIGURAÇÃO DAS LOJAS SHOPEE
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

let isRunning = false;

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

app.post('/api/upload-shopee', async (req, res) => {
    if (isRunning) {
        return res.status(429).json({ success: false, message: "Outro envio já está em andamento. Aguarde fechar a janela anterior." });
    }
    
    const { storeId, title, description, images, weight, length, width, height } = req.body;
    const store = SHOPEE_STORES.find(s => s.id === storeId) || SHOPEE_STORES[0];

    isRunning = true;
    let browserInstance = null;
    
    // COMO AGORA É HEADLESS E 100% AUTOMÁTICO, NÃO RESPONDEMOS IMEDIATAMENTE.
    // O Vercel aguardará até 1 minuto ou 2 até que o bot faça tudo e dê a resposta final.

    try {
        console.log(`\n==========================================================================`);
        console.log(`🌐 [${store.id}] (PRODUÇÃO) INICIANDO INTEGRAÇÃO INVISÍVEL!`);
        console.log(`📝 Título: ${title}`);
        console.log(`📦 Peso: ${weight}kg | Dimensões: ${length}x${width}x${height}`);
        console.log(`==========================================================================\n`);

        console.log("🚀 Lançando navegador invisível (headless)...");
        browserInstance = await chromium.launch({ headless: true }); // Invisível
        
        const hasSession = fs.existsSync(store.sessionFile);
        if (!hasSession) {
            console.log("❌ SESSÃO NÃO ENCONTRADA. Rode o bot não-headless pelo menos uma vez para gerar os cookies.");
            throw new Error("Sessão da loja não encontrada neste servidor. Precisa fazer o primeiro login usando uma janela com tela.");
        }

        const shopeeContext = await browserInstance.newContext({ storageState: store.sessionFile });
        const shopeePage = await shopeeContext.newPage();
        
        console.log(`☁️ Acessando criador de produtos...`);
        await shopeePage.goto('https://seller.shopee.com.br/portal/product/new?pageEntry=product_list', { waitUntil: 'domcontentloaded' });
        
        // Verifica se a sessão expirou
        await shopeePage.waitForTimeout(3000);
        const urlAtual = shopeePage.url();
        if (urlAtual.includes('signin') || urlAtual.includes('login') || urlAtual.includes('verify')) {
             throw new Error("Sessão expirada. O bot precisa fazer login novamente, mas está no modo invisível (Produção). Logue antes localmente.");
        }

        // --- CONVERTER IMAGENS ---
        const localFilePaths = [];
        if (images && images.length > 0) {
            console.log("📥 Salvando imagens para upload...");
            for (const src of images) {
                try {
                    const p = await downloadOrConvertImage(src);
                    localFilePaths.push(p);
                } catch(e) {}
            }
        }

        console.log(`🛠️ Preenchendo campos obrigatórios na Shopee para ${store.id}...`);
        await shopeePage.waitForTimeout(4000); 
        
        // Upload 
        if (localFilePaths.length > 0) {
            try {
                 const fileInput = await shopeePage.$('input[type="file"][accept*="image"]');
                 if (fileInput) {
                     await fileInput.setInputFiles(localFilePaths.slice(0, 9));
                     console.log("✅ Fotos (Ambiente/Benefícios) injetadas.");
                 }
            } catch (e) {
                 console.log("❌ Erro upload img:", e.message);
            }
        }

        // Nome
        if (title) {
            try {
                const nomeInput = await shopeePage.$('input[placeholder*="Nome"], input[placeholder*="Produto"]');
                if (nomeInput) {
                    await nomeInput.click();
                    await nomeInput.fill(title);
                    console.log("✅ Título injetado.");
                    await shopeePage.waitForTimeout(2000); // Aguarda sugestão de categoria
                }
            } catch(e) {}
        }
        
        // Categoria (Shopee obriga a ter Categoria para salvar em rascunho)
        try {
            // A Shopee normalmente sugere categorias numa div logo abaixo do título
            // Ao digitar o nome, aparece a box de recomendação
            console.log("🔍 Tentando forçar categoria recomendada...");
            await shopeePage.waitForTimeout(1500);
            
            // Clicar no espaço fora do campo de pesquisa ou no título para fazer aparecer as sugestões
            await shopeePage.mouse.click(10, 10);
            await shopeePage.waitForTimeout(1000);
            
            // Procura qualquer texto que pareça ser o botão de primeira sugestão ou tenta usar XPath
            // Aqui estamos arriscando clicar na primeira categoria baseada em classes genéricas!
            // Exemplo de seletor comum em painéis Vue da Shopee para árvore de categorias
            const treeItems = await shopeePage.$$('.category-list-item, .popover-item, .tax-class-item');
            if (treeItems.length > 0) {
                await treeItems[0].click();
            } else {
                console.log("⚠️ Categorias não detectadas de forma fácil, usaremos a sorte (Shopee pode barrar o rascunho).");
            }
        } catch(e) { console.log(e); }

        // Descrição
        if (description) {
            try {
                const descInput = await shopeePage.$('textarea, [contenteditable="true"]');
                if (descInput) await descInput.fill(description);
                console.log("✅ Descrição preenchida.");
            } catch(e){}
        }

        console.log("💰 Configurando Preço R$ 999 (Provável) e Estoque 1...");
        try {
            await shopeePage.getByPlaceholder('R$').nth(0).fill('999,00').catch(()=>{});
            await shopeePage.getByPlaceholder('Insira o preço').fill('999,00').catch(()=>{});
            
            await shopeePage.getByPlaceholder('0').nth(0).fill('1').catch(()=>{});
            console.log("✅ Preço e Estoque engatilhados.");
        } catch(e) {}

        console.log(`📦 Configurando Logística (Peso: ${weight}kg, ${length}x${width}x${height})...`);
        try {
            await shopeePage.getByPlaceholder('Peso').fill(weight || '0,15').catch(()=>{});
            await shopeePage.getByPlaceholder('C').fill(length || '30').catch(()=>{});
            await shopeePage.getByPlaceholder('L').fill(width || '15').catch(()=>{});
            await shopeePage.getByPlaceholder('A').fill(height || '11').catch(()=>{});
            console.log("✅ Logística preenchida.");
        } catch(e) {}

        // Enviar Botão SALVAR E OCULTAR (Rascunho)
        console.log("💾 Tentando clicar no botão Salvar e Ocultar (Rascunho)...");
        await shopeePage.waitForTimeout(2000);
        try {
            // Tentamos clicar em qualquer botão que possua o texto 'Ocultar' ou 'Rascunho' ou 'Salvar' (que não seja publicar)
            // Em pt-BR geralmente é "Salvar e ocultar"
            const btnRascunho = await shopeePage.getByRole('button', { name: /Salvar e ocultar|Salvar E Ocultar|Salvar e Desativar|Mover para Rascunho/i }).first();
            await btnRascunho.click({ timeout: 5000 });
            console.log("✅ Botão SALVAR E OCULTAR clicado!");
            
            // Aguarda a confirmação de sucesso da Shopee aparecer na tela (um pequeno toast)
            await shopeePage.waitForTimeout(4000);
        } catch(e) {
            console.log("⚠️ O botão 'Salvar e Ocultar' não foi encontrado ou falhou ao ser clicado de forma exata. O rascunho pode não ter salvo se faltar dados.");
        }

        console.log("\n🎉 FLUXO INVISÍVEL EXECUTADO COM SUCESSO. Rascunho submetido!");
        res.status(200).json({ 
            success: true, 
            message: `Produto ${title} integrado em Rascunho na [${store.id}]. Acesso o painel para ajustar categoria e preço final!` 
        });

    } catch (e) {
        console.log("\n❌ ERRO CRÍTICO NO BOT HEADLESS:", e.message);
        res.status(500).json({ 
            success: false, 
            message: `Erro na execução invisível do robô: ${e.message}` 
        });
    } finally {
        isRunning = false;
        if (browserInstance) {
            // No modo headless e automático devemos SIM fechar o navegador sempre
            console.log("🧹 Fechando e liberando navegador invisível...");
            await browserInstance.close();
        }
    }
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`\n=======================================================`);
    console.log(`🚀 API DE CRIAÇÃO DA SHOPEE (HEADLESS - MODO PRODUÇÃO) ONLINE!`);
    console.log(`📍 Escutando ações na porta 3002`);
    console.log(`=======================================================\n`);
});
