const express = require('express');
const router  = express.Router();
const {
  createRestaurant,
  getAllRestaurants,
  getRestaurant,
  updateSubscription,
  toggleRestaurant,
} = require('../controllers/restaurantController');
const { requireSuperAdmin } = require('../middleware/auth');

// All routes protected by Fanu's super admin secret header
// No OMS user (even restaurant admin) can reach these
router.use(requireSuperAdmin);

router.post('/',                              createRestaurant);
router.get('/',                               getAllRestaurants);
router.get('/:restaurantId',                  getRestaurant);
router.put('/:restaurantId/subscription',     updateSubscription);
router.put('/:restaurantId/toggle',           toggleRestaurant);

module.exports = router;