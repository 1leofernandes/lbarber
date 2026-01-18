// Validações reutilizáveis
const validators = {
  email: (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },

  password: (senha) => {
    // Mínimo 6 caracteres (você pode aumentar para produção)
    return typeof senha === 'string' && senha.length >= 6;
  },

  nome: (nome) => {
    return typeof nome === 'string' && nome.trim().length >= 3;
  },

  hora: (hora) => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(hora);
  },

  data: (data) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(data);
  },

  id: (id) => {
    return Number.isInteger(parseInt(id)) && parseInt(id) > 0;
  }
};

const validateRequired = (fields, data) => {
  const errors = [];
  fields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors.push(`${field} é obrigatório`);
    }
  });
  return errors;
};

module.exports = {
  validators,
  validateRequired
};
