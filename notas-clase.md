Escrow: el contrato JobMarketplace es el escrow. Recibe los tokens del cliente y solo los libera si el trabajo existe, está fondeado/entregado y el evaluador aprueba.
localStorage: es la opción más simple y aceptada para esta entrega. En blockchain guardamos solo bytes32 deliverableRef.
Errores personalizados: usarlos en Solidity, por ejemplo NotClient(), InvalidStatus(), JobExpired().
Tests: podemos usar Hardhat con tests en .ts, que es lo más cómodo para este repo.
Wallets: el frontend tiene que conectarse con wallet real, usando lo que ya tenías de Entrega 1.
Multisig/Safe Wallet: para la lógica general, el evaluador puede ser cualquier contrato que llame a complete. En tests conviene usar el Multisig de la Entrega 2 porque la consigna lo pide explícitamente. En deploy real/Sepolia se puede documentar que también funciona con Safe Wallet si Safe ejecuta el calldata hacia complete.