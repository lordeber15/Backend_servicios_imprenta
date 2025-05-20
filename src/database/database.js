const Sequelize = require("sequelize");
const { DB_DEPLOY } = process.env;
console.log(DB_DEPLOY);
const sequelize = new Sequelize(
  /*"postgres://qoriapp_user:rXle6FdEvdFUNTM4yP6UeHxHRU90q2A8@dpg-cnl5r7gl6cac73edb7cg-a.oregon-postgres.render.com/qoriapp",
  {
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Esto es opcional, dependiendo de la configuración de tu servidor PostgreSQL
      },
    },
  }*/

  "postgresql://postgres:RoyAYLcYXaylAXQlvDtLrpQCPdZbWiwb@postgres.railway.internal:5432/railway"
);

module.exports = sequelize;
