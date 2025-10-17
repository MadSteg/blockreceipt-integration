import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlockReceiptAPI } from '../services/BlockReceiptAPI';

export default function WalletSetupScreen({ route, navigation }: any) {
  const { phoneNumber } = route.params;
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const response = await BlockReceiptAPI.getWalletStatus(phoneNumber);
      
      if (response.success) {
        Alert.alert(
          'Wallet Created!',
          `Your BlockReceipt wallet has been created.\n\nAddress: ${response.walletAddress}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', 'Failed to create wallet. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="wallet" size={64} color="#6366f1" />
        <Text style={styles.title}>Setup Your Wallet</Text>
        <Text style={styles.subtitle}>
          We'll create a secure wallet for your BlockReceipts
        </Text>
      </View>

      <View style={styles.phoneContainer}>
        <Text style={styles.phoneLabel}>Phone Number</Text>
        <Text style={styles.phoneNumber}>{phoneNumber}</Text>
      </View>

      <View style={styles.features}>
        <View style={styles.feature}>
          <Ionicons name="shield-checkmark" size={24} color="#10b981" />
          <Text style={styles.featureText}>Secure & Private</Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="receipt" size={24} color="#6366f1" />
          <Text style={styles.featureText}>Digital Receipts</Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="gift" size={24} color="#f59e0b" />
          <Text style={styles.featureText}>Loyalty Rewards</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.setupButton, loading && styles.setupButtonDisabled]}
        onPress={handleSetup}
        disabled={loading}
      >
        <Text style={styles.setupButtonText}>
          {loading ? 'Creating Wallet...' : 'Create Wallet'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  phoneContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  phoneLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  features: {
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  setupButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  setupButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
