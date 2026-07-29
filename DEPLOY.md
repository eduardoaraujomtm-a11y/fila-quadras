# Guia de produção — Supabase + Vercel

Siga na ordem. Onde precisar de mim (Claude), está marcado com 👉.

## 1. Criar o projeto Supabase (grátis)

1. Acesse https://supabase.com e crie uma conta / novo projeto.
2. Dê um nome (ex.: `fila-quadras`) e defina uma senha do banco. Escolha a região mais próxima (South America / São Paulo).
3. Espere o projeto provisionar (~2 min).

## 2. Criar as tabelas

1. No projeto, abra **SQL Editor** (menu lateral) → **New query**.
2. Cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique **Run**.
3. Deve aparecer "Success". Isso cria as tabelas e cadastra as 3 quadras.

## 3. Pegar as chaves

Em **Project Settings → API**:
- **Project URL** → vai em `NEXT_PUBLIC_SUPABASE_URL`
- **Project API keys → `service_role` (secret)** → vai em `SUPABASE_SERVICE_ROLE_KEY`
  - ⚠️ A `service_role` é secreta. Nunca coloque no cliente nem no Git. Só como variável de ambiente no servidor.

👉 Me mande essas duas informações (ou coloque você mesmo nos próximos passos).

## 4. Testar localmente com o Supabase

1. Na pasta do projeto, copie `.env.local.example` para `.env.local`.
2. Preencha as duas variáveis com os valores do passo 3.
3. Rode `npm run dev` e teste — agora os dados persistem no Supabase (não se perdem ao reiniciar).

## 5. Subir para o GitHub

O projeto já é um repositório Git com um commit inicial. Crie um repositório vazio no GitHub e:

```bash
cd fila-quadras
git remote add origin https://github.com/SEU_USUARIO/fila-quadras.git
git branch -M main
git push -u origin main
```

## 6. Deploy na Vercel

1. Acesse https://vercel.com, faça login com o GitHub.
2. **Add New → Project** e importe o repositório `fila-quadras`.
3. Em **Environment Variables**, adicione as duas:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Clique **Deploy**. Em ~1 min o app está no ar num endereço `https://fila-quadras-xxxx.vercel.app`.
5. Depois, todo `git push` para `main` publica automaticamente (igual aos seus outros apps).

## 7. Imprimir o QR final

Com o app no ar, abra `SEU_ENDERECO/qr` — o QR já aponta para o endereço público.
Clique **Imprimir** e cole na recepção e nas quadras.

## Telas para deixar abertas no clube

- **TV/tablet na parede:** `SEU_ENDERECO/painel`
- **Recepção:** `SEU_ENDERECO/recepcao`
- **QR (impresso):** aponta para `SEU_ENDERECO/checkin`
- **Divulgar aos sócios (consulta de casa):** `SEU_ENDERECO/publico`
