const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const User = require('./models/User');
    const result = await User.updateMany({}, { $addToSet: { roles: 'admin' } });
    console.log('Updated ' + result.modifiedCount + ' users to be admins.');
    process.exit(0);
  })
  .catch(err => { console.error(err); process.exit(1); });
