
import "dotenv/config";
import { User } from "./models/User.js";
import { initDB } from "./config/db.js";

async function upgrade() {
    await initDB();
    const email = "admin_test_99@example.com";
    const user = await User.findOne({ where: { email } });
    if (user) {
        user.role = "ADMIN";
        await user.save();
        console.log(`Upgraded ${email} to ADMIN`);
    } else {
        console.log("User not found");
    }
    process.exit();
}

upgrade();
