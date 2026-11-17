'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('consultas_chat', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      colaborador_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'colaboradores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      pregunta: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      intencion: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      agente: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      documentos_citados: {
        type: Sequelize.JSON,
        allowNull: true
      },
      resuelta: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      escalada: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      latencia_ms: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      fecha: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('consultas_chat', ['colaborador_id']);
    await queryInterface.addIndex('consultas_chat', ['intencion']);
    await queryInterface.addIndex('consultas_chat', ['agente']);
    await queryInterface.addIndex('consultas_chat', ['fecha']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('consultas_chat');
  }
};

