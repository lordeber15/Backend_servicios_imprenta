const { Op } = require("sequelize");
const sequelize = require("../../../infrastructure/database/database");
const {
  NotifierPayment, NotifierRawNotification, NotifierEnrollToken,
} = require("../../../infrastructure/database/models/notifier/notifier");
const { notifierConfig } = require("../../../infrastructure/config/notifier");

const DIA = 24 * 60 * 60 * 1000;
const ANONIMIZADO = "[anonimizado]";

/**
 * Retención de datos personales de los pagos Yape/Plin. La corre el worker una
 * vez al día; los plazos se configuran con NOTIFIER_RETENTION_* en el .env.
 */
async function aplicarRetencion(ahora = new Date()) {
  const hace = (dias) => new Date(ahora.getTime() - dias * DIA);
  const d = notifierConfig.retencion;

  return sequelize.transaction(async (transaction) => {
    const [codigos] = await NotifierPayment.update(
      { security_code: null },
      { where: { security_code: { [Op.ne]: null }, paid_at: { [Op.lt]: hace(d.codigoSeguridad) } }, transaction },
    );
    const [textos] = await NotifierRawNotification.update(
      { text: ANONIMIZADO, title: null, big_text: null },
      { where: { received_at: { [Op.lt]: hace(d.textoOriginal) }, text: { [Op.ne]: ANONIMIZADO } }, transaction },
    );
    const noReconocidas = await NotifierRawNotification.destroy({
      where: { status: { [Op.in]: ["UNPARSED", "IGNORED"] }, received_at: { [Op.lt]: hace(d.noReconocidas) } },
      transaction,
    });
    const codigosEnlace = await NotifierEnrollToken.destroy({ where: { expires_at: { [Op.lt]: hace(1) } }, transaction });

    // Nombres de pagadores: solo si se definió un plazo (0 = conservar, obligación contable).
    let nombres = 0;
    if (d.nombres > 0) {
      [nombres] = await NotifierPayment.update(
        { sender_name: ANONIMIZADO, name_masked: false },
        { where: { paid_at: { [Op.lt]: hace(d.nombres) }, sender_name: { [Op.ne]: ANONIMIZADO } }, transaction },
      );
    }
    return { codigos, textos, noReconocidas, codigosEnlace, nombres };
  });
}

/** Programa la retención cada 24 h (primera pasada al minuto de arrancar). */
function programarRetencion() {
  const correr = () => aplicarRetencion()
    .then((r) => console.log(`[Pagos] Retención aplicada: ${JSON.stringify(r)}`))
    .catch((e) => console.error("[Pagos] Falló la retención:", e.message));
  const inicial = setTimeout(correr, 60 * 1000);
  const diario = setInterval(correr, DIA);
  return { close: () => { clearTimeout(inicial); clearInterval(diario); } };
}

module.exports = { aplicarRetencion, programarRetencion };
