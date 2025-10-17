import { Router } from 'express';
import { storage } from '../storage-real';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const router = Router();

// Create new user
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(2).optional(),
  fullName: z.string().min(2).optional(),
  walletAddress: z.string().optional()
});

router.post('/', async (req, res) => {
  try {
    const validatedData = createUserSchema.parse(req.body);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);
    
    const userData = {
      ...validatedData,
      password: hashedPassword
    };

    const user = await storage.createUser(userData);
    
    // Don't send back the password hash
    const { password, ...userResponse } = user;
    
    res.status(201).json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Error creating user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user' 
    });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const user = await storage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't send back the password hash
    const { password, ...userResponse } = user;

    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user' 
    });
  }
});

// Get user by email
router.get('/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't send back the password hash
    const { password, ...userResponse } = user;

    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Error fetching user by email:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user' 
    });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const updates = req.body;
    
    // If password is being updated, hash it
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const user = await storage.updateUser(userId, updates);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't send back the password hash
    const { password, ...userResponse } = user;

    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update user' 
    });
  }
});

// Login authentication
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    const user = await storage.getUserByEmail(validatedData.email);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const passwordMatch = await bcrypt.compare(validatedData.password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    // Update last login
    await storage.updateUser(user.id, { lastLogin: new Date() });

    // Don't send back the password hash
    const { password, ...userResponse } = user;

    res.json({
      success: true,
      user: userResponse,
      message: 'Login successful'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Error during login:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to authenticate' 
    });
  }
});

export default router;