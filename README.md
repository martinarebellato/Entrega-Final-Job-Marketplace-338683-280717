# Entrega Final - Job Marketplace

Marketplace de trabajos sobre Ethereum Sepolia con escrow en ERC-20, evaluador configurable y soporte para usar un contrato Multisig como evaluador.

El flujo principal es:

1. Un cliente publica un trabajo con descripcion, presupuesto, evaluador, proveedor opcional y fecha de expiracion.
2. El cliente aprueba el token ERC-20 y fondea el escrow.
3. El proveedor envia una entrega off-chain representada en el contrato como `bytes32`.
4. El evaluador aprueba para liberar el pago al proveedor o rechaza para reembolsar al cliente.
5. Si el trabajo expira estando `Funded` o `Submitted`, cualquier cuenta puede ejecutar `claimRefund`.

## Stack

- Solidity + Hardhat + TypeScript
- OpenZeppelin `IERC20`, `SafeERC20` y `ReentrancyGuard`
- React + Vite + TypeScript
- wagmi + viem
- RainbowKit
- TanStack Query

## Contratos

- `contracts/JobMarketplace.sol`: contrato principal del marketplace y escrow.
- `contracts/Multisig.sol`: contrato multisig usado como evaluador M-de-N.
- `contracts/mocks/MockERC20.sol`: token ERC-20 de prueba para tests, deploy local y pruebas en Sepolia.

`JobMarketplace` recibe el token ERC-20 en el constructor. Todos los trabajos creados en esa instancia se pagan con ese mismo token.

## Direcciones En Sepolia

Completar esta seccion luego de desplegar en Sepolia.

| Contrato | Direccion |
| --- | --- |
| `MockERC20` / payment token | `TODO` |
| `Multisig` | `TODO` |
| `JobMarketplace` | `TODO` |
| Bloque de deploy de `JobMarketplace` | `TODO` |

El bloque de deploy se usa en el frontend como `VITE_MARKETPLACE_DEPLOY_BLOCK` para leer eventos `JobCreated` desde el bloque correcto.

## Instalacion

Instalar dependencias del proyecto Hardhat:

```bash
npm install
```

Instalar dependencias del frontend:

```bash
cd frontend
npm install
```

## Tests Y Validaciones

Desde la raiz del repo:

```bash
npm run compile
npm test
npx tsc --noEmit
```

Desde `frontend`:

```bash
npm run typecheck
npm run build
```

Validacion realizada:

- `npm run compile`: OK
- `npm test`: OK, 23 tests pasando
- `frontend/npm run typecheck`: OK
- `frontend/npm run build`: OK

## Configuracion De Deploy

Crear `.env` en la raiz usando `.env.example` como base:

```text
SEPOLIA_RPC_URL=
PRIVATE_KEY=
PAYMENT_TOKEN_ADDRESS=
MULTISIG_SIGNERS=
MULTISIG_THRESHOLD=
```

`PRIVATE_KEY` debe ser la clave de una wallet de prueba con Sepolia ETH para gas. No commitear `.env`.

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

## Configuracion Del Frontend

Crear `frontend/.env` usando `frontend/.env.example` como base:

```text
VITE_WALLETCONNECT_PROJECT_ID=
VITE_JOB_MARKETPLACE_ADDRESS=
VITE_PAYMENT_TOKEN_ADDRESS=
VITE_MULTISIG_ADDRESS=
VITE_MARKETPLACE_DEPLOY_BLOCK=
```

Despues de `npm run deploy:all`, copiar:

- `JOB_MARKETPLACE_ADDRESS` a `VITE_JOB_MARKETPLACE_ADDRESS`
- `PAYMENT_TOKEN_ADDRESS` a `VITE_PAYMENT_TOKEN_ADDRESS`
- `MULTISIG_ADDRESS` a `VITE_MULTISIG_ADDRESS`
- `MARKETPLACE_DEPLOY_BLOCK` a `VITE_MARKETPLACE_DEPLOY_BLOCK`

Para correr el frontend localmente:

```bash
cd frontend
npm run dev
```

El frontend funciona contra Sepolia. La wallet debe estar conectada a Sepolia y tener ETH de prueba para pagar gas.

## Funcionalidad Implementada

### Contrato

- `createJob(description, budget, evaluator, provider, expiresAt)`: crea un trabajo `Open`.
- `setProvider(jobId, provider)`: permite al cliente asignar proveedor si el trabajo esta `Open` y no tiene proveedor.
- `fund(jobId)`: transfiere el presupuesto desde el cliente al escrow luego de `approve`.
- `submit(jobId, deliverableRef)`: permite al proveedor enviar una referencia `bytes32`.
- `complete(jobId, reason)`: permite al evaluador liberar fondos al proveedor si el trabajo esta `Submitted` y no expiro.
- `reject(jobId, reason)`: permite al cliente rechazar en `Open` o al evaluador rechazar en `Funded`/`Submitted`.
- `claimRefund(jobId)`: permite a cualquiera reembolsar al cliente si el trabajo expiro estando `Funded` o `Submitted`.

Las funciones que mueven fondos usan `nonReentrant` y `SafeERC20`. Las transiciones invalidas revierten con errores personalizados.

### Frontend

- Conexion de wallet con RainbowKit.
- Listado de trabajos leyendo eventos `JobCreated` y badge de estado actualizado con `getJob`.
- Detalle de trabajo leyendo el struct completo con `getJob`, incluyendo direcciones completas.
- Formulario para publicar trabajos.
- Panel de acciones segun rol de la wallet conectada.
- `approve` + `fund` para fondear trabajos.
- Estados pendientes mientras confirma la transaccion.
- Invalidacion de queries luego de confirmar escrituras.
- Mensajes de error cuando una transaccion revierte o falla.

## Deliverables Off-Chain

El contrato solo guarda `deliverableRef` como `bytes32`. El contenido de la entrega se guarda en `localStorage` del navegador.

La referencia se calcula hasheando el contenido de la entrega. Esto evita guardar datos pesados en blockchain y mantiene el contrato alineado con la consigna, que permitia manejar entregables off-chain.

Limitacion: al usar `localStorage`, el evaluador debe usar el mismo navegador/dispositivo para ver el contenido guardado. En una version productiva se podria reemplazar por IPFS o una base de datos.

## Multisig Como Evaluador

El evaluador de un trabajo puede ser una wallet o un contrato. Si se usa `Multisig` como evaluador, los signers deben:

1. Crear una propuesta cuyo destino sea `JobMarketplace`.
2. Usar como calldata la llamada `complete(jobId, reason)`.
3. Aprobar la propuesta hasta alcanzar el threshold.
4. Ejecutar la propuesta desde el Multisig.

Cuando el Multisig ejecuta la llamada, `JobMarketplace` recibe `msg.sender == address(multisig)` y acepta la aprobacion.

El mismo diseno es compatible con otros contratos evaluadores, por ejemplo Safe Wallet, siempre que ejecuten la llamada `complete(jobId, reason)`.

## Decisiones De Diseno

- El presupuesto es inmutable: se define en `createJob` y no puede modificarse despues.
- El token de pago es unico por instancia de `JobMarketplace`: se pasa en el constructor para simplificar el escrow y evitar mezclar balances de distintos tokens.
- `claimRefund` no tiene control de acceso: cualquier cuenta puede ejecutarlo una vez vencido el plazo, tal como pide la consigna.
- Se usan eventos para las transiciones relevantes: creacion, asignacion de proveedor, fondeo, entrega, aprobacion, rechazo y reembolso.
- El frontend lista trabajos desde eventos `JobCreated` para no depender de un backend propio.
- El estado actual se lee con `getJob`, porque el evento de creacion no alcanza para conocer cambios posteriores.
- `complete` tambien valida la expiracion para que un evaluador no pueda aprobar un trabajo vencido y competir con `claimRefund`.
- Los errores del contrato son personalizados para ahorrar gas y facilitar tests.

## Desvios Y Limitaciones

- Los deliverables se guardan en `localStorage`, no en IPFS ni base de datos. Esto esta permitido por la letra, pero limita el acceso a la entrega al mismo navegador donde se cargo.
- El tablero lista los trabajos creados desde eventos `JobCreated`; para el badge de estado actual hace una lectura adicional con `getJob`.
- El token `MockERC20` incluye `mint(address,uint256)` para facilitar pruebas manuales en Sepolia. No es un token productivo.
- Las direcciones de Sepolia deben completarse en este README despues del deploy final.

## Seguridad

- Las funciones que transfieren fondos usan `nonReentrant`.
- Los fondos se mueven con `SafeERC20`.
- El contrato actualiza el estado antes de transferir tokens.
- `complete` revierte con `JobExpired` si el trabajo ya vencio.
- `claimRefund` no depende de hooks ni permisos especiales.
- Las claves privadas y RPC URLs deben mantenerse fuera del repositorio en `.env`.
