'use strict';

const express = require('express');
const { getAllTravelPackages, getTravelPackageBySlug } = require('../controllers/travel.controller');

const router = express.Router();

router.get('/', getAllTravelPackages);
router.get('/:slug', getTravelPackageBySlug);

module.exports = router;
