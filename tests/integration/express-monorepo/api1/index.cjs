const express = require('express');
const app = express();
const port = 3001;

app.get('/*', (req, res) => {
  res.send(`Hello from API 1!`);
});

app.listen(port, () => {
  console.log(`API1 listening on port ${port}`);
});
