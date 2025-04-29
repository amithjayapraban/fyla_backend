# 🔌 ip2p_backend
A lightweight WebSocket-based signaling server that enables peer-to-peer communication using IP-based room separation.
 
<a href="https://github.com/amithjayapraban/ip2p"  target="_blank">Frontend Repository</a>
### Limitations

- State management across multiple instances is not supported. Use a data store like Redis for shared state.
- The WebSocket library used in this project does not have built-in support for scaling across multiple instances, which may lead to challenges in handling high traffic or distributed deployments.
