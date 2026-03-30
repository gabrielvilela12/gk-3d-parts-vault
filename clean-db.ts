import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load env from .env
const envContent = readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) env[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanData() {
  const { data: pieces, error } = await supabase.from('pieces').select('id, name, stock_by_color');
  if (error) {
    console.error(error);
    return;
  }
  
  for (const p of pieces) {
    if (p.stock_by_color && Array.isArray(p.stock_by_color)) {
      const originalLen = p.stock_by_color.length;
      const filtered = p.stock_by_color.filter((colorItem: any) => {
        return colorItem.color !== '2' && colorItem.color !== '3';
      });
      
      if (filtered.length !== originalLen) {
        // We found bad colors
        const newTotal = filtered.reduce((acc, curr) => acc + curr.quantity, 0);
        console.log(`Fixing piece ${p.name}... New total: ${newTotal}`);
        
        await supabase.from('pieces').update({
          stock_by_color: filtered,
          stock_quantity: newTotal
        }).eq('id', p.id);
      }
    }
  }
  console.log("Cleanup complete.");
}

cleanData();
