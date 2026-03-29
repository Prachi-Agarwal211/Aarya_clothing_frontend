"""
API Key Encryption Utility for Aarya Clothing AI System

This module provides secure encryption/decryption of API keys before storing in database.
Uses Fernet symmetric encryption (AES-128-CBC) from cryptography library.

SECURITY NOTES:
- Encryption key MUST be stored in environment variable ENCRYPTION_KEY
- Never commit encryption key to version control
- Rotate encryption key periodically (see rotate_key method)
- All API keys are encrypted at rest
"""

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os
import hashlib


class APIKeyEncryptor:
    """Handles encryption and decryption of API keys"""
    
    def __init__(self, encryption_key: str = None):
        """
        Initialize encryptor with encryption key
        
        Args:
            encryption_key: Base64-encoded 32-byte key. If None, uses ENCRYPTION_KEY env var.
        """
        # Get key from parameter or environment
        key = encryption_key or os.getenv('ENCRYPTION_KEY')
        
        if not key:
            # Generate a new key if none exists (for initial setup)
            key = self.generate_key()
            print(f"⚠️  WARNING: Generated new encryption key. Add this to your .env file:")
            print(f"ENCRYPTION_KEY={key}")
            print(f"⚠️  Store this key securely! If lost, all encrypted API keys will be unrecoverable.")
        
        # If key is not base64-encoded, encode it
        try:
            # Try to decode as base64
            base64.b64decode(key)
            self.key = key.encode()
        except:
            # Key is not base64, encode it
            self.key = self._encode_key(key)
        
        self.cipher = Fernet(self.key)
    
    def _encode_key(self, key: str) -> bytes:
        """Convert a string key to base64-encoded Fernet key"""
        # Hash the key to get a fixed-size 32-byte key
        key_hash = hashlib.sha256(key.encode()).digest()
        # Base64 encode it
        return base64.urlsafe_b64encode(key_hash)
    
    @staticmethod
    def generate_key() -> str:
        """Generate a new Fernet encryption key"""
        return Fernet.generate_key().decode()
    
    def encrypt(self, api_key: str) -> str:
        """
        Encrypt an API key
        
        Args:
            api_key: Plain text API key to encrypt
            
        Returns:
            Base64-encoded encrypted key
        """
        if not api_key:
            return api_key  # Return empty string as-is
        
        encrypted = self.cipher.encrypt(api_key.encode('utf-8'))
        return base64.urlsafe_b64encode(encrypted).decode('utf-8')
    
    def decrypt(self, encrypted_key: str) -> str:
        """
        Decrypt an API key
        
        Args:
            encrypted_key: Base64-encoded encrypted key
            
        Returns:
            Plain text API key
        """
        if not encrypted_key or not self._is_encrypted(encrypted_key):
            return encrypted_key  # Return as-is if not encrypted
        
        try:
            # Decode from base64
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_key.encode('utf-8'))
            # Decrypt
            decrypted = self.cipher.decrypt(encrypted_bytes)
            return decrypted.decode('utf-8')
        except Exception as e:
            print(f"❌ Failed to decrypt API key: {e}")
            return None
    
    def _is_encrypted(self, value: str) -> bool:
        """Check if a value appears to be encrypted"""
        if not value or len(value) < 50:
            return False
        
        # Encrypted values are base64-encoded and start with specific pattern
        try:
            decoded = base64.urlsafe_b64decode(value.encode('utf-8'))
            # Fernet tokens have a specific structure
            return len(decoded) > 40 and decoded.startswith(b'gAAAAA')
        except:
            return False
    
    def re_encrypt(self, old_encrypted_key: str, new_encryption_key: str) -> str:
        """
        Re-encrypt a key with a new encryption key (for key rotation)
        
        Args:
            old_encrypted_key: Key encrypted with old encryption key
            new_encryption_key: New encryption key to use
            
        Returns:
            Key re-encrypted with new key
        """
        # Decrypt with current key
        decrypted = self.decrypt(old_encrypted_key)
        if not decrypted:
            return None
        
        # Create new cipher with new key
        new_key_encoded = self._encode_key(new_encryption_key)
        new_cipher = Fernet(new_key_encoded)
        
        # Re-encrypt with new key
        new_encrypted = new_cipher.encrypt(decrypted.encode('utf-8'))
        return base64.urlsafe_b64encode(new_encrypted).decode('utf-8')


# Global encryptor instance (lazy initialization)
_encryptor = None

def get_encryptor() -> APIKeyEncryptor:
    """Get or create the global encryptor instance"""
    global _encryptor
    if _encryptor is None:
        _encryptor = APIKeyEncryptor()
    return _encryptor


def encrypt_api_key(api_key: str) -> str:
    """Convenience function to encrypt an API key"""
    return get_encryptor().encrypt(api_key)


def decrypt_api_key(encrypted_key: str) -> str:
    """Convenience function to decrypt an API key"""
    return get_encryptor().decrypt(encrypted_key)


# Example usage
if __name__ == "__main__":
    # Generate a key for testing
    test_key = APIKeyEncryptor.generate_key()
    encryptor = APIKeyEncryptor(test_key)
    
    # Test encryption/decryption
    original_key = "sk-test-1234567890abcdefghijklmnop"
    print(f"Original: {original_key}")
    
    encrypted = encryptor.encrypt(original_key)
    print(f"Encrypted: {encrypted}")
    
    decrypted = encryptor.decrypt(encrypted)
    print(f"Decrypted: {decrypted}")
    
    print(f"Match: {original_key == decrypted}")
