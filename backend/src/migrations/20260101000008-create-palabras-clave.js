'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('palabras_clave', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      palabra: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      categoria: {
        type: Sequelize.ENUM(
          'restringida',
          'fuera_alcance',
          'politica',
          'dato_personal',
          'tema_dashboard'
        ),
        allowNull: false
      },
      tema_asociado: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      activa: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex('palabras_clave', ['categoria', 'activa']);
    await queryInterface.addConstraint('palabras_clave', {
      fields: ['palabra', 'categoria'],
      type: 'unique',
      name: 'uq_palabras_clave_palabra_categoria'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('palabras_clave');
  }
};

