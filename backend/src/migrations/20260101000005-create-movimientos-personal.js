'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('movimientos_personal', {
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
      tipo: {
        type: Sequelize.ENUM('ingreso', 'salida', 'ascenso'),
        allowNull: false
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      motivo: {
        type: Sequelize.STRING(255),
        allowNull: false
      }
    });

    await queryInterface.addIndex('movimientos_personal', ['colaborador_id']);
    await queryInterface.addIndex('movimientos_personal', ['tipo']);
    await queryInterface.addIndex('movimientos_personal', ['fecha']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('movimientos_personal');
  }
};

