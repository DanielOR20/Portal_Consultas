'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('consultas_chat');
    if (!tableDesc.util) {
      await queryInterface.addColumn('consultas_chat', 'util', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('consultas_chat');
    if (tableDesc.util) {
      await queryInterface.removeColumn('consultas_chat', 'util');
    }
  }
};
