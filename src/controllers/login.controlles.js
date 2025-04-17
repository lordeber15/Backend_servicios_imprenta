const { Login } = require("../models/login");

const getLogin = async (req, res) => {
  try {
    const getLogin = await Login.findAll();
    res.json(getLogin);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createLogin = async (req, res) => {
  try {
    const { usuario, password, cargo } = req.body;
    const newLogin = await Login.create({
        usuario, password, cargo
    });
    res.json(newLogin);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
const deleteLogin = async (req, res) => {
  try {
    const { id } = req.params;

    const login = await Login.findByPk(id);

    if (!login) {
      return res.status(404).json({ message: "elemento no encontrado" });
    }

    await login.destroy();

    res.json({ message: "elemento eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
const updateLogin = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario, password, cargo } = req.body;

    const loginupdate = await Login.findByPk(id);

    if (!loginupdate) {
      return res.status(404).json({ message: "elemento no encontrado" });
    }

    loginupdate.usuario = usuario;
    loginupdate.password = password;
    loginupdate.cargo = cargo;

    await loginupdate.save();

    res.json(loginupdate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { getLogin, createLogin, deleteLogin, updateLogin };
