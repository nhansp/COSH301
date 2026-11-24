-- +goose Up
-- One row per usability-test submission from /khao-sat: the ten SUS answers,
-- which test tasks the tester completed, and free-text feedback. Submissions
-- may be anonymous, so there is no foreign key to users and no IP address.
CREATE TABLE feedback_responses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tester_role   VARCHAR(20) NOT NULL CHECK (tester_role IN ('AUDIENCE', 'ORGANIZER')),
    tester_name   VARCHAR(100),
    device        VARCHAR(20) CHECK (device IN ('PHONE', 'TABLET', 'LAPTOP')),

    -- SUS items 1-10, Likert 1 (strongly disagree) to 5 (strongly agree).
    sus_q1        SMALLINT NOT NULL CHECK (sus_q1 BETWEEN 1 AND 5),
    sus_q2        SMALLINT NOT NULL CHECK (sus_q2 BETWEEN 1 AND 5),
    sus_q3        SMALLINT NOT NULL CHECK (sus_q3 BETWEEN 1 AND 5),
    sus_q4        SMALLINT NOT NULL CHECK (sus_q4 BETWEEN 1 AND 5),
    sus_q5        SMALLINT NOT NULL CHECK (sus_q5 BETWEEN 1 AND 5),
    sus_q6        SMALLINT NOT NULL CHECK (sus_q6 BETWEEN 1 AND 5),
    sus_q7        SMALLINT NOT NULL CHECK (sus_q7 BETWEEN 1 AND 5),
    sus_q8        SMALLINT NOT NULL CHECK (sus_q8 BETWEEN 1 AND 5),
    sus_q9        SMALLINT NOT NULL CHECK (sus_q9 BETWEEN 1 AND 5),
    sus_q10       SMALLINT NOT NULL CHECK (sus_q10 BETWEEN 1 AND 5),

    -- Test tasks: completed or not, and the optional time taken in seconds.
    task_login    BOOLEAN NOT NULL DEFAULT FALSE,
    task_hold     BOOLEAN NOT NULL DEFAULT FALSE,
    task_pay      BOOLEAN NOT NULL DEFAULT FALSE,
    task_ticket   BOOLEAN NOT NULL DEFAULT FALSE,
    time_login    INT CHECK (time_login BETWEEN 0 AND 3600),
    time_hold     INT CHECK (time_hold BETWEEN 0 AND 3600),
    time_pay      INT CHECK (time_pay BETWEEN 0 AND 3600),
    time_ticket   INT CHECK (time_ticket BETWEEN 0 AND 3600),

    comment       TEXT CHECK (char_length(comment) <= 2000),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_responses_created ON feedback_responses(created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS feedback_responses;
