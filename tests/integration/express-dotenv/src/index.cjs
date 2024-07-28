const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send(`Hello ${process.env.HELLO}!<br/><br/>My Origin is ${process.env.ORIGIN}`);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
