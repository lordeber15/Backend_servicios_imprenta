const axios = require("axios");

/**
 * CONTROLADOR RENIEC
 * 
 * Se encarga de la integración con el servicio externo 'apis.net.pe'
 * para la consulta de datos de ciudadanos a partir de su número de DNI.
 */

/**
 * Consulta datos de DNI en RENIEC
 *
 * @route GET /api/reniec/:dni
 */
const getReniec = async (req, res) => {
  const dni = req.params.dni;
  const token = process.env.DECOLECTA_API_KEY;

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
