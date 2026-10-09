# Offshore SCADA

Servidor local com WebSocket, Modbus TCP, normalização de sinais, alarmes com confirmação e histórico agregado por intervalo.

## Executar

Requisitos: Node.js 24 e TypeScript.

```sh
npm ci
npm test
npm run dev
```

## Funcionamento

WebSocket: `ws://127.0.0.1:8080/telemetry`. Modbus TCP: `127.0.0.1:1502`. `/history?tag=nome&from=timestamp&to=timestamp&interval=1000` consulta média, extremos e último valor de dados válidos. Histórico em memória com retenção limitada; exporte os resultados relevantes para persistência.

## Persistência de resultados

O arquivo de operações está em [vercel-home-telemetry-api.vercel.app](https://vercel-home-telemetry-api.vercel.app/laboratory.html?project=offshore-scada-simulator). As migrações Supabase estão no [repositório da API](https://github.com/brunnojob/vercel-home-telemetry-api/tree/main/supabase/migrations).

```sh
python cloud/sync.py enqueue resultado.json --project offshore-scada-simulator
python cloud/sync.py sync
```

Defina `BRUNNODEV_ACCESS_TOKEN` com sua sessão. A fila SQLite conserva os relatórios até confirmação do servidor; o mesmo conteúdo não gera registros duplicados. Tokens não são gravados no código.
