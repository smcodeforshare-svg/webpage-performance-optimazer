class UserRepository:
    def __init__(self, session):
        self.session = session

    # Bottleneck: N+1 query loop fetching profiles individually for each user
    def get_users_with_profiles(self, user_ids):
        results = []
        for uid in user_ids:
            profile = self.session.query("Profile").filter_by(user_id=uid).first()
            results.append(profile)
        return results
