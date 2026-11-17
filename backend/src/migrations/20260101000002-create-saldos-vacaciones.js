'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('saldos_vacaciones', {
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
      periodo: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      dias_asignados: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 15.0
      },
      dias_tomados: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0
      },
      dias_disponibles: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 15.0
      }
    });

    await queryInterface.addConstraint('saldos_vacaciones', {
      fields: ['colaborador_id', 'periodo'],
      type: 'unique',
      name: 'uq_saldos_vacaciones_colaborador_periodo'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('saldos_vacaciones');
  }
};

