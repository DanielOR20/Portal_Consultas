'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('incapacidades', {
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
        type: Sequelize.ENUM('enfermedad_comun', 'riesgo_trabajo', 'maternidad'),
        allowNull: false
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      dias: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      entidad: {
        type: Sequelize.ENUM('CCSS', 'INS'),
        allowNull: false
      }
    });

    await queryInterface.addIndex('incapacidades', ['colaborador_id']);
    await queryInterface.addIndex('incapacidades', ['fecha_inicio']);
    await queryInterface.addIndex('incapacidades', ['entidad']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('incapacidades');
  }
};

