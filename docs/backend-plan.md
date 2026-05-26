# Backend Plan

## Likes and ratings

In a backend-backed version, story likes should be stored on the server instead of only in `localStorage`.

Recommended table:

```sql
story_likes
```

Fields:

- `id`
- `story_id`
- `user_id`
- `created_at`

Constraints:

- Add a unique constraint on `(story_id, user_id)` so one user can like one story only once.

API endpoints:

- `POST /api/stories/:id/like` - add a like for the authenticated user.
- `DELETE /api/stories/:id/like` - remove the authenticated user's like.
- `GET /api/stories/:id/likes` - return the total like count and whether the current user liked the story.

Behavior:

- When authentication is available, likes should be stored on the server and associated with `user_id`.
- Public stories should show a shared total like counter.
- Private user stories can either store likes only for the owner or disable the public like counter.
- The frontend can keep an optimistic UI update, but the server response should be treated as the source of truth.
