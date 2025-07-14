const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'lbarberoficial1@gmail.com',
        pass: 'wgpr yemc neow ursr'
    }
});

const mailOptions = {
    from: 'lbarberoficial1@gmail.com',
    to: 'anajuliadof@gmail.com', // Alguém que você controla
    subject: 'Email',
    text: 'teste email'
};

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log('Erro ao enviar email:', error);
    }
    console.log('Email enviado: ' + info.response);
});
// Carrega os barbeiros
const loadBarbeiros = async () => {
  try {
      const response = await fetch('http://localhost:3000/barbeiros', {
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      if (!response.ok) {
          throw new Error('Falha ao carregar barbeiros');
      }
      const barbeiros = await response.json();
      console.log(barbeiros);

      barbeiros.forEach(barbeiro => {
          const option = document.createElement('option');
          option.value = barbeiro.id;
          option.textContent = barbeiro.nome;
          selectBarbeiro.appendChild(option);
      });
  } catch (error) {
      console.error('Erro ao carregar barbeiros:', error);
  }
};
  