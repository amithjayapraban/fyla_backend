# 🔌 ip2p_backend

A lightweight WebSocket-based signaling server that enables peer-to-peer communication using IP-based room separation.

### Limitations

- The `clients` object and `pendingUpdates` set are global, which may cause issues in a clustered or distributed environment.
- State management across multiple instances is not supported natively. Consider using a data store like Redis for shared state.
- The WebSocket library used in this project does not have built-in support for scaling across multiple instances, which may lead to challenges in handling high traffic or distributed deployments.
