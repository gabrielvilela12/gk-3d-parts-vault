
-- Update parcela 1/10 -> 10/11/2025 (pago)
UPDATE expenses SET order_date = '2025-11-10T00:00:00+00', order_status = 'pago', payment_date = '2025-11-10T00:00:00+00' WHERE id = '97141ba9-d34b-4e5e-9c8c-c7e3b5b8d007';

-- Update parcela 2/10 -> 10/12/2025 (pago)
UPDATE expenses SET order_date = '2025-12-10T00:00:00+00', order_status = 'pago', payment_date = '2025-12-10T00:00:00+00' WHERE id = 'b05c051b-bd94-40d1-aaa8-bf52f967c805';

-- Update parcela 3/10 -> 10/01/2026 (pago)
UPDATE expenses SET order_date = '2026-01-10T00:00:00+00', order_status = 'pago', payment_date = '2026-01-10T00:00:00+00' WHERE id = '12b31172-7539-4d5a-b381-1c9d347b2740';

-- Update parcela 4/10 -> 10/02/2026 (pago)
UPDATE expenses SET order_date = '2026-02-10T00:00:00+00', order_status = 'pago', payment_date = '2026-02-10T00:00:00+00' WHERE id = '0cd8ec17-b6a1-499c-998a-be065ccdde9e';

-- Update parcela 5/10 -> 10/03/2026 (pendente - próximo pagamento)
UPDATE expenses SET order_date = '2026-03-10T00:00:00+00', order_status = 'pendente' WHERE id = 'c0c27124-627a-4caa-a75a-fae576c30a9d';

-- Update parcela 6/10 -> 10/04/2026 (pendente)
UPDATE expenses SET order_date = '2026-04-10T00:00:00+00', order_status = 'pendente' WHERE id = 'c58e5817-a54d-4a3a-89ea-23266c2f57e7';

-- Update parcela 7/10 -> 10/05/2026 (pendente)
UPDATE expenses SET order_date = '2026-05-10T00:00:00+00', order_status = 'pendente' WHERE id = '32b88e50-b072-4827-82a1-d6cc82e3527e';

-- Update parcela 8/10 -> 10/06/2026 (pendente)
UPDATE expenses SET order_date = '2026-06-10T00:00:00+00', order_status = 'pendente' WHERE id = 'db75cd0d-def5-47a3-8f4a-c71a145bd4a7';

-- Update parcela 9/10 -> 10/07/2026 (pendente)
UPDATE expenses SET order_date = '2026-07-10T00:00:00+00', order_status = 'pendente' WHERE id = '973f3a67-0400-473e-b02f-462bf5f566b9';

-- Update parcela 10/10 -> 10/08/2026 (pendente)
UPDATE expenses SET order_date = '2026-08-10T00:00:00+00', order_status = 'pendente' WHERE id = 'db85df75-a410-4c4d-9b3a-15fee915f7fd';
