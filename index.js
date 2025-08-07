const app = require("./src/app");
const sequelize = require("./src/database/database");
const port = process.env.DB_PORT || 3000;

async function main() {
  try {
    await sequelize.sync({ force: false });
    console.log("Estas Conectado");
    app.listen(port, () => {
      console.log("Escuchando en el puerto:", port);
    });
    //module.exports.handler = serverless(app)
  } catch (error) {
    console.error("Tienes Un error en:", error);
  }
}

main();
