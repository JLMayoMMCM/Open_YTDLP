export function connectProgressSocket(onMessage) {
  let socket = null;
  let retryDelay = 1000;

  function open() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${protocol}://${location.host}/api/ws/progress`);

    socket.addEventListener("open", () => {
      retryDelay = 1000;
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error("Bad WS message", err);
      }
    });

    socket.addEventListener("close", () => {
      setTimeout(open, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 15000);
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  open();
}
