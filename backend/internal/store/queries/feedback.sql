-- name: CreateFeedback :one
INSERT INTO feedback_responses (
    tester_role, tester_name, device,
    sus_q1, sus_q2, sus_q3, sus_q4, sus_q5, sus_q6, sus_q7, sus_q8, sus_q9, sus_q10,
    task_login, task_hold, task_pay, task_ticket,
    time_login, time_hold, time_pay, time_ticket,
    comment
) VALUES (
    $1, $2, $3,
    $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    $14, $15, $16, $17,
    $18, $19, $20, $21,
    $22
) RETURNING *;

-- name: ListFeedback :many
SELECT * FROM feedback_responses ORDER BY created_at, id;
