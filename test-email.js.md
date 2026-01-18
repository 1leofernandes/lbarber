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
