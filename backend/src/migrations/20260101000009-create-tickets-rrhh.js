'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tickets_rrhh', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      codigo: {
        type: Sequelize.STRING(30),
        allowNull: false,
        unique: true
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
      consulta_original: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      motivo: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      estado: {
        type: Sequelize.ENUM('abierto', 'en_revision', 'resuelto'),
        allowNull: false,
        defaultValue: 'abierto'
      },
      respuesta_rrhh: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      atendido_por: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'colaboradores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      resuelto_en: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('tickets_rrhh', ['colaborador_id']);
    await queryInterface.addIndex('tickets_rrhh', ['estado']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tickets_rrhh');
  }
};

