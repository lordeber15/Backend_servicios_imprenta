const axios = require("axios");

const getReniec = async (req, res) => {
  const dni = req.params.dni;
  const token = "apis-token-16299.1l9ndIMxkIIiHfeLTQiTF8cxGNvDoFkt";

  try {
    const response = await axios.get(
      `https://api.apis.net.pe/v2/reniec/dni?numero=${dni}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error(
      "Error al consultar Reniec:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Error al consultar Reniec" });
  }
};

module.exports = {
  getReniec,
};
