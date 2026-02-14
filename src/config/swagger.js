const swaggerJsDoc = require("swagger-jsdoc");

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "API de Imprenta Alexander",
      version: "1.0.0",
      description: "Documentación interactiva de la API para la gestión de imprenta, facturación electrónica y servicios.",
      contact: {
        name: "Soporte Técnico",
      },
      servers: [
        {
          url: "https://apiimpalexander.store",
          description: "Servidor de Desarrollo",
        },
      ],
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Rutas a escanear para las anotaciones
  apis: ["./src/routes/**/*.js", "./src/routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerDocs;
