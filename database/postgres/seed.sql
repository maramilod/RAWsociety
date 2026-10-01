-- Reference data the website needs on day one. Safe to run once after schema.sql.
BEGIN;

-- Specialties from the creator onboarding form
INSERT INTO categories (slug, name, sort_order) VALUES
    ('graphic-design-branding',   'Graphic Design & Branding',    1),
    ('ui-ux-design',              'UI/UX Design',                 2),
    ('video-editing-motion',      'Video Editing & Motion',       3),
    ('3d-animation',              '3D & Animation',               4),
    ('software-web-development',  'Software & Web Development',   5),
    ('photography-videography',   'Photography & Videography',    6);

-- Plans from /onboarding/plan (prices in LYD per month)
INSERT INTO plans (code, audience, name, price, limits, features, sort_order) VALUES
    ('creator_free', 'creator', 'Free', 0,
        '{"max_works":3,"can_message":false,"browse_creators":6}',
        '["Browse 6 creators","Showcase up to 3 works","No direct messaging"]', 1),
    ('creator_pro', 'creator', 'Pro', 50,
        '{"max_works":15,"can_message":true,"stats":true}',
        '["Everything unlocked","Showcase up to 15 works","Direct messaging + Stats"]', 2),
    ('creator_max', 'creator', 'Max', 70,
        '{"max_works":null,"can_message":true,"stats":true,"featured":true,"priority_support":true}',
        '["Unlimited works","Featured profile placement","Priority support"]', 3),
    ('client_free', 'client', 'Free', 0,
        '{"max_briefs":3,"can_message":false,"branding":false}',
        '["Browse creator portfolios","Send up to 3 project briefs","Standard support","No custom company branding / logo"]', 1),
    ('client_pro', 'client', 'Business Pro', 150,
        '{"max_briefs":null,"can_message":true,"branding":true,"verified_filter":true}',
        '["Unlimited project briefs","Direct chat & file sharing","Verified creator filter","Custom company branding & logo"]', 2),
    ('client_enterprise', 'client', 'Enterprise', 350,
        '{"max_briefs":null,"can_message":true,"branding":true,"verified_filter":true,"account_manager":true}',
        '["Dedicated account manager","Custom contracts & invoicing","VIP talent matchmaking","Custom company branding & logo"]', 3);

COMMIT;
