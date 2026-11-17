'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reportes_diarios', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        unique: true
      },
      datos_json: {
        type: Sequelize.JSON,
        allowNull: false
      },
      resumen_texto: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      generado_por: {
        type: Sequelize.STRING(100),
        allowNull: false
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reportes_diarios');
  }
};

