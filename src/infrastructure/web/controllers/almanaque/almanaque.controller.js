const Almanaque = require("../../../database/models/almanaque/almanaque");
const Detalle = require("../../../database/models/almanaque/detallesAlmanaque");

// Obtener todos los Almanaques con sus detalles
const getAlmanaque = async (req, res) => {
  try {
    const almanaques = await Almanaque.findAll({
      include: [{ model: Detalle, as: "detalles" }],
    });
    res.json(almanaques);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Obtener un dato de Almanaques con sus detalles
const getAlmanaqueById = async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Validar que el id sea un número
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    // Buscar un solo registro incluyendo sus detalles
    const almanaque = await Almanaque.findByPk(id, {
      include: [{ model: Detalle, as: "detalles" }],
    });

    if (!almanaque) {
      return res.status(404).json({ message: "Almanaque no encontrado" });
    }

    res.json(almanaque);
  } catch (error) {
    console.error("Error al obtener almanaque:", error);
    res.status(500).json({ message: error.message });
  }
};

// Crear Almanaque con detalles
const createAlmanaque = async (req, res) => {
  try {
    const {
      cliente,
      tipoDocumento,
      numeroDocumento,
      direccion,
      fechaEmision,
      aCuenta,
      precioTotal,
      detalles,
    } = req.body;

    const nuevoAlmanaque = await Almanaque.create(
      {
        cliente,
        tipoDocumento,
        numeroDocumento: numeroDocumento || null,
        direccion,
        fechaEmision,
        aCuenta,
        precioTotal,
        detalles, // Sequelize insertará automáticamente en DetalleAlmanaque
      },
      {
        include: [{ model: Detalle, as: "detalles" }],
      }
    );

    res.json(nuevoAlmanaque);
  } catch (error) {
    console.log("📦 Datos recibidos:", req.body);
    console.error("❌ Error en createAlmanaque:", error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
};

// Actualizar Almanaque con detalles
const updateAlmanaque = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cliente,
      tipoDocumento,
      numeroDocumento,
      direccion,
      fechaEmision,
      aCuenta,
      precioTotal,
      detalles,
    } = req.body;

    const registro = await Almanaque.findByPk(id, { include: ["detalles"] });
    if (!registro)
      return res.status(404).json({ message: "Almanaque no encontrado" });

    // Actualizar los campos principales
    registro.cliente = cliente;
    registro.tipoDocumento = tipoDocumento;
    registro.numeroDocumento = numeroDocumento;
    registro.direccion = direccion;
    registro.fechaEmision = fechaEmision;
    registro.aCuenta = aCuenta;
    registro.precioTotal = precioTotal;
    await registro.save();

    // Reemplazar los detalles
    await Detalle.destroy({ where: { AlmanaqueId: registro.id } });
    if (detalles && detalles.length > 0) {
      await Detalle.bulkCreate(
        detalles.map((d) => ({ ...d, AlmanaqueId: registro.id }))
      );
    }

    const actualizado = await Almanaque.findByPk(registro.id, {
      include: ["detalles"],
    });
    res.json(actualizado);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Eliminar Almanaque
const deleteAlmanaque = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await Almanaque.findByPk(id);

    if (!registro) {
      return res.status(404).json({ message: "Almanaque no encontrado" });
    }

    await registro.destroy();
    res.json({ message: "Almanaque eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAlmanaque,
  createAlmanaque,
  updateAlmanaque,
  deleteAlmanaque,
  getAlmanaqueById,
};
