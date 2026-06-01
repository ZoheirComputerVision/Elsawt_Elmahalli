const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: path.join(__dirname, 'data', 'database.sqlite'),
  DATA_DIR: path.join(__dirname, 'data'),
  PUBLIC_DIR: path.join(__dirname, 'public'),
  ADMIN_DIR: path.join(__dirname, 'admin'),

  SCHOOL_NAME: 'ثانوية المجاهد خليل محمد المدعو يوسف',
  SCHOOL_SUB: 'عين كرمس - تيارت',
  ADMIN_TEAM: 'Zoheir IT Solutions',

  AI: {
    AUTO_PUBLISH_THRESHOLD: 0.8,
    REVIEW_THRESHOLD: 0.5,
    MAX_DRAFT_AGE_HOURS: 72,
    COLLECTOR_INTERVAL_MIN: 30,
    FACEBOOK_PAGE: 'Mujahid56khallil.Mohammed26SecondarySchool.2023',
    MINISTRY_URL: 'https://www.education.gov.dz/',
  },

  SAFETY: {
    STOP_AUTO_PUBLISH: false,
    REQUIRE_HUMAN_REVIEW: false,
    MAX_PUBLISH_PER_DAY: 20,
  },
};
