const Sequelize = require("sequelize");
const { DATABASE_URL } = process.env;
console.log(DATABASE_URL)
const sequelize = new Sequelize(
  "postgres://postgres:123456@localhost:5432/servicios",
  //DATABASE_URL,
  /*{
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Esto es opcional, dependiendo de la configuración de tu servidor PostgreSQL
      },
    },
  }*/

);

module.exports = sequelize;
