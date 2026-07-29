# Fila das Quadras 🎾

Fila virtual por ordem de chegada das quadras de tênis do clube — substitui o quadro de caneta.
PWA em Next.js, atualização ao vivo por polling, com backend Supabase (ou em memória para testes).

**Para colocar em produção (Supabase + Vercel), siga o [DEPLOY.md](DEPLOY.md).**

## Rodar localmente

```bash
cd fila-quadras
npm install
npm run dev
```

Abra http://localhost:3000 (ou a porta que aparecer). Na mesma rede Wi-Fi, outros
celulares acessam pelo IP da máquina (ex.: http://192.168.0.44:3000) — assim o painel
da parede numa TV e os celulares dos atletas veem os mesmos dados ao vivo.

## As 4 telas

| Rota | Tela | Uso |
|------|------|-----|
| `/` | Início | Atalhos para as 4 telas |
| `/checkin` | App do atleta | Check-in (simula o QR), escolher parceiro, entrar na fila |
| `/painel` | Painel da parede | Quadras ao vivo + fila. Deixe aberto numa TV/tablet |
| `/publico` | Consulta pública | Ver de casa: quadras, espera, horários de pico |
| `/recepcao` | Recepção (admin) | Chamar próxima, iniciar/encerrar jogo, bloquear aula, grade fixa, controlar fila |
| `/qr` | QR de check-in | Gera e imprime o QR para colar no clube |

## Regras implementadas

- **Regra dos 2 presentes**: só forma dupla com quem já fez check-in (escaneou o QR).
- **Ordem de chegada**: fila por horário automático (quando a dupla fica completa).
- **Pareamento sem aceite**: quem escolhe o parceiro já coloca a dupla na fila; dá para desfazer.
- **Limite de tempo**: cronômetro de 60 min por jogo (barra fica vermelha nos últimos 5 min).
- **Preparo = tempo neutro**: entre jogos a quadra fica "em preparo"; o cronômetro da próxima
  dupla só começa quando a recepção toca "Iniciar jogo".
- **Bloqueio de aula**: avulso (na hora) + **grade fixa recorrente** que bloqueia sozinha no horário.
- **Horários de pico**: calculados do histórico real de check-ins (usa um exemplo até juntar dados).
- **QR real** (`/qr`): imprime o QR que aponta para o `/checkin`. Identidade salva no aparelho.
- **PWA instalável**: manifest + service worker + ícones — dá para "adicionar à tela inicial".
- **Painel = consulta pública**: a mesma visão ao vivo aparece na parede e no celular.

## Arquitetura de dados

`lib/db.js` escolhe o backend automaticamente:
- Com as variáveis do Supabase definidas → **Supabase/Postgres** (`lib/supabaseDb.js`), persistente.
- Sem elas → **memória** (`lib/store.js`), ótimo para testes locais (dados somem ao reiniciar).

As Route Handlers (`app/api/*`) só falam com `lib/db.js`. Schema em [`supabase/schema.sql`](supabase/schema.sql).

## Ainda por evoluir

- Tempo real por **polling** (2–3s). Dá para trocar pelo realtime do Supabase depois (as tabelas
  já estão na publicação `supabase_realtime`).
- Limpeza automática de presenças antigas (hoje o filtro é "últimas 6h" no Supabase).
