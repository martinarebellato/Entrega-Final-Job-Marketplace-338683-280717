# Entrega Final - Job Marketplace

**Puntaje:** 60 pts

## Objetivo

Implementar un marketplace de empleos sobre Ethereum, inspirado en ERC-8183 (*Agentic Commerce Protocol*), un estándar mínimo de escrow para flujos de cliente/proveedor/evaluador.

---

## Resumen

El marketplace tiene tres roles:

* **Cliente:** publica un trabajo, bloquea el pago en escrow y lo fondea.
* **Proveedor:** acepta el trabajo y entrega un resultado.
* **Evaluador:** revisa la entrega y libera el pago o reembolsa al cliente.

El evaluador no tiene que ser una sola persona. Si la dirección evaluadora de un trabajo es tu contrato Multisig, entonces M-de-N revisores designados deben llegar a consenso antes de que se libere el pago. Esto no requiere ninguna integración adicional, pues surge naturalmente del protocolo.

El evaluador puede ser en realidad cualquier otro contrato capaz de llamar a nuestro contrato en calidad de evaluador, y la lógica puede ser la deseada.

El acceso al delivery del job puede manejarse off-chain por dos motivos:

* Para que el trabajo no sea público hasta que el evaluador dé el visto bueno.
* Porque el storage en blockchain es caro.

Por lo tanto, los deliverables se deben guardar en algún otro lugar. Las opciones van de simple a ambicioso:

* **localStorage:** suficiente para esta entrega. El proveedor guarda el contenido localmente y el evaluador debe estar en el mismo navegador para verlo.
* **Base de datos:** permite que cualquier participante acceda desde cualquier dispositivo.
* **IPFS:** la opción más alineada con el espíritu descentralizado del protocolo. Se puede explorar como bonus.

---

# Parte A - El Contrato

Escribir `JobMarketplace.sol` con la siguiente especificación.

## Estado

* Una lista de `Jobs`.
* Cada `Job` debe tener:

  * un cliente,
  * un evaluador,
  * un proveedor,
  * y trackear el estado del `Job`.
* Los trabajos se pagan en un único token ERC-20 determinado al momento de hacer el deploy del contrato `JobMarketplace`.

---

## Funciones

| Función                                                          | Acceso                                                | Descripción                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `createJob(description, budget, evaluator, provider, expiresAt)` | Cualquiera                                            | Crea un trabajo en estado `Open`. `evaluator` es obligatorio. `provider` es opcional.                 |
| `setProvider(jobId, provider)`                                   | Cliente                                               | Asigna proveedor a un trabajo `Open` que aún no tiene proveedor.                                      |
| `fund(jobId)`                                                    | Cliente                                               | Transfiere los tokens `budget` al escrow. El `budget` es inmutable desde la creación del trabajo.     |
| `submit(jobId, deliverableRef)`                                  | Proveedor                                             | Pasa el trabajo a `Submitted`. `deliverableRef` es un `bytes32`.                                      |
| `complete(jobId, reason)`                                        | Evaluador                                             | Libera los fondos al proveedor. `reason` es una atestación `bytes32`.                                 |
| `reject(jobId, reason)`                                          | Cliente en `Open` o Evaluador en `Funded`/`Submitted` | Reembolsa al cliente.                                                                                 |
| `claimRefund(jobId)`                                             | Cualquiera                                            | Reembolsa al cliente si `block.timestamp > expiresAt`. Pasa a `Expired`. Nunca debe poder bloquearse. |

---

## Requerimientos del contrato

* Emitir eventos donde corresponda.
* Toda transición inválida debe revertir.
* Se prefieren errores personalizados sobre strings de revert.
* Evitar reentrancy en todas las funciones que mueven fondos.
* `claimRefund` no debe tener control de acceso ni hooks. Nunca puede quedar bloqueada.
* Escribir tests que cubran:

  * **Happy path:** crear → fondear → entregar → completar.
  * **Rechazo:**

    * el cliente rechaza en `Open`;
    * el evaluador rechaza en `Funded`;
    * el evaluador rechaza en `Submitted`.
  * **Expiración:**

    * `claimRefund` funciona desde `Funded`;
    * `claimRefund` funciona desde `Submitted`.
  * **Control de acceso:**

    * cada función restringida es llamada por la dirección incorrecta y revierte.
  * **Multisig como evaluador:**

    * desplegar el Multisig de la Entrega 2;
    * asignarlo como evaluador de un trabajo;
    * demostrar que `complete` solo tiene éxito después de que el Multisig alcanza el threshold y ejecuta el llamado.

---

# Parte B - El Frontend

Extender el dashboard de las Entregas 1 y 2 hasta convertirlo en una UI completa del marketplace.

Reemplazar todo estado simulado con lecturas y escrituras reales al contrato.

---

## Pantallas

### 1. Tablero de Trabajos

Listar todos los trabajos leyendo eventos `JobCreated`.

Mostrar:

* descripción,
* budget,
* badge de estado,
* dirección del cliente.

---

### 2. Detalle de Trabajo

Mostrar el struct completo del trabajo:

* todas las direcciones,
* estado,
* fecha de expiración.

También debe mostrar el panel de acción correcto según el rol de la billetera conectada.

---

### 3. Publicar Trabajo

Formulario que llama a `createJob`.

Campos:

* descripción,
* budget,
* dirección del evaluador,
* proveedor opcional,
* fecha de expiración.

La dirección del evaluador puede ser la dirección del contrato Multisig.

---

## Panel de Acciones según Rol

| Usuario    | Estado del trabajo               | Acción mostrada                                      |
| ---------- | -------------------------------- | ---------------------------------------------------- |
| Cliente    | `Open`, sin proveedor            | `"Asignar Proveedor"` (`setProvider`)                |
| Cliente    | `Open`                           | `"Fondear Trabajo"` (`approve ERC-20 → fund`)        |
| Cliente    | `Open`                           | `"Rechazar"`                                         |
| Proveedor  | `Funded`                         | `"Enviar Entrega"` recibe el pointer del deliverable |
| Evaluador  | `Submitted`                      | `"Aprobar"` (`complete`) y `"Rechazar"`              |
| Cualquiera | `Funded` o `Submitted`, expirado | `"Reclamar Reembolso"`                               |

---

## Requerimientos de UX

* Conexión de billetera vía RainbowKit o ConnectKit, manteniendo lo de la Entrega 1.
* Toda escritura muestra un estado de pendiente mientras la transacción confirma.
* Al confirmar, el estado del trabajo se actualiza sin recargar la página, invalidando la query correspondiente.
* Al revertir, mostrar el motivo del error de forma clara.
* Sin datos simulados ni código comentado.

---

# Entrega

Un repositorio de GitHub con un `README.md` claro, que debe incluir:

* Instrucciones para correr los tests.
* Instrucciones para correr el frontend localmente.
* Direcciones en Sepolia de ambos contratos.
* Documentación especificando decisiones en el diseño.
* Cualquier desvío de la especificación y su justificación.
