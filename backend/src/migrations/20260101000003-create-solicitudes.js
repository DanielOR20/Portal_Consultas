'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('solicitudes', {
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
        type: Sequelize.ENUM('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'teletrabajo'),
        allowNull: false
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      fecha_fin: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      estado: {
        type: Sequelize.ENUM('pendiente', 'aprobada', 'rechazada'),
        allowNull: false,
        defaultValue: 'pendiente'
      },
      aprobador_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'colaboradores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      creada_en: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('solicitudes', ['colaborador_id']);
    await queryInterface.addIndex('solicitudes', ['estado']);
    await queryInterface.addIndex('solicitudes', ['tipo']);
    await queryInterface.addIndex('solicitudes', ['fecha_inicio', 'fecha_fin']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('solicitudes');
  }
};

