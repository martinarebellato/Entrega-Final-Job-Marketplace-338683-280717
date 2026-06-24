# Entrega Final - Job Marketplace

Marketplace de trabajos sobre Ethereum Sepolia con escrow en ERC-20, evaluador configurable y soporte para usar el contrato Multisig como evaluador.

## Stack

- Solidity + Hardhat + TypeScript
- OpenZeppelin ERC-20 utilities
- React + Vite + TypeScript
- wagmi + viem
- RainbowKit
- TanStack Query

## Tests y Compilacion

Instalar dependencias de contratos:

```bash
npm install
```

Compilar contratos:

```bash
npm run compile
```

Correr tests:

```bash
npx hardhat test
```

Validar TypeScript del proyecto Hardhat:

```bash
npx tsc --noEmit
```

## Deploy En Sepolia

Antes de desplegar, crear un archivo `.env` en la raiz del proyecto usando `.env.example` como base.

Nunca commitear `.env`. Usar una wallet de prueba, con Sepolia ETH suficiente para gas.

Variables requeridas en `.env`:

```text
SEPOLIA_RPC_URL=
PRIVATE_KEY=
PAYMENT_TOKEN_ADDRESS=
MULTISIG_SIGNERS=
MULTISIG_THRESHOLD=
```

`PRIVATE_KEY` debe ser la clave de una wallet de prueba. No compartirla ni imprimirla.

`MULTISIG_SIGNERS` debe ser una lista separada por comas:

```text
MULTISIG_SIGNERS=0xSigner1,0xSigner2,0xSigner3
MULTISIG_THRESHOLD=2
```

### Deploy Completo

Para desplegar token de prueba, Multisig y JobMarketplace en una sola corrida:

```bash
npm run deploy:all
```

El script imprime:

- `PAYMENT_TOKEN_ADDRESS`
- `MULTISIG_ADDRESS`
- `JOB_MARKETPLACE_ADDRESS`
- `MARKETPLACE_DEPLOY_BLOCK`
- un bloque listo para copiar a `frontend/.env`

### Deploy Por Partes

Desplegar solo el token ERC-20 mock:

```bash
npm run deploy:token
```

Desplegar solo el Multisig:

```bash
npm run deploy:multisig
```

Desplegar solo el JobMarketplace usando `PAYMENT_TOKEN_ADDRESS`:

```bash
npm run deploy:marketplace
```

## MockERC20

`MockERC20` se usa como token de pago para pruebas locales y Sepolia.

Al desplegarse, mintea `1,000,000 MPT` al deployer. Tambien expone `mint(address,uint256)` para facilitar pruebas manuales con otras wallets.

## Configuracion Del Frontend

Crear `frontend/.env` usando `frontend/.env.example` como base:

```text
VITE_WALLETCONNECT_PROJECT_ID=
VITE_JOB_MARKETPLACE_ADDRESS=
VITE_PAYMENT_TOKEN_ADDRESS=
VITE_MULTISIG_ADDRESS=
VITE_MARKETPLACE_DEPLOY_BLOCK=
```

Despues de `npm run deploy:all`, copiar las direcciones impresas:

- `JOB_MARKETPLACE_ADDRESS` a `VITE_JOB_MARKETPLACE_ADDRESS`
- `PAYMENT_TOKEN_ADDRESS` a `VITE_PAYMENT_TOKEN_ADDRESS`
- `MULTISIG_ADDRESS` a `VITE_MULTISIG_ADDRESS`
- `MARKETPLACE_DEPLOY_BLOCK` a `VITE_MARKETPLACE_DEPLOY_BLOCK`

`VITE_MARKETPLACE_DEPLOY_BLOCK` permite leer eventos `JobCreated` desde el bloque correcto sin escanear toda Sepolia.

Instalar dependencias del frontend:

```bash
cd frontend
npm install
```

Validar TypeScript:

```bash
npm run typecheck
```

Compilar frontend:

```bash
npm run build
```

Correr localmente:

```bash
npm run dev
```

## Flujo Del Marketplace

1. El cliente crea un job con `createJob`.
2. El cliente aprueba el ERC-20 y fondea con `fund`.
3. El proveedor envuelve el contenido off-chain en un hash `bytes32` y llama `submit`.
4. El evaluador llama `complete` para liberar fondos al proveedor o `reject` para reembolsar al cliente.
5. Si el job expira en `Funded` o `Submitted`, cualquier cuenta puede llamar `claimRefund`.

Los deliverables se guardan off-chain en `localStorage`. En blockchain solo se guarda `deliverableRef`.

## Multisig Como Evaluador

El evaluador puede ser una wallet normal o un contrato. Si el evaluador del job es el contrato `Multisig`, entonces los signers deben crear y aprobar una propuesta cuyo destino sea `JobMarketplace` y cuyo calldata sea `complete(jobId, reason)`.

Cuando el Multisig alcanza el threshold y ejecuta la propuesta, `JobMarketplace` ve `msg.sender == address(multisig)` y acepta la aprobacion.

El mismo diseño es compatible con Safe Wallet si Safe ejecuta la llamada `complete(jobId, reason)`.
