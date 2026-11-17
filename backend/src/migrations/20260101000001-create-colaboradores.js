'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('colaboradores', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      departamento: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      puesto: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      fecha_ingreso: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      jefe_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'colaboradores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      rol: {
        type: Sequelize.ENUM('colaborador', 'rrhh'),
        allowNull: false,
        defaultValue: 'colaborador'
      },
      estado: {
        type: Sequelize.ENUM('activo', 'inactivo'),
        allowNull: false,
        defaultValue: 'activo'
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

    await queryInterface.addIndex('colaboradores', ['departamento']);
    await queryInterface.addIndex('colaboradores', ['jefe_id']);
    await queryInterface.addIndex('colaboradores', ['estado']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('colaboradores');
  }
};

