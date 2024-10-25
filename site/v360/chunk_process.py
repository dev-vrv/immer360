import base64
import math
import os

def chunk_maker(images, index):
    images_result = []
    total_images = len(images)
    chunk_size = 18
    total_chunks = math.ceil(total_images / chunk_size)
    
    # Define key points with step to avoid duplicate indexes
    key_points = list(range(0, total_images, total_images // chunk_size))
    
    # Define expansion points based on index
    expansion_key_points = []
    for key_point in key_points:
        new_index = key_point + index
        if new_index < total_images:
            expansion_key_points.append(new_index)
    
    # Add images based on expanded key points
    for key_point in expansion_key_points:
        try:
            images_result.append(images[key_point])
        except IndexError:
            pass
        
    # Prepare the base64 encoded chunks
    encoded_chunks = []

    for image in images_result:
        if os.path.exists(image):
            with open(image, "rb") as image_file:
                encoded_chunks.append({
                    'index': os.path.splitext(image_file.name.split('_')[-1])[0],  # Use correct image index extraction
                    'base64': base64.b64encode(image_file.read()).decode('utf-8'),
                })
        else:
            print(f"Warning: Image {image} not found!")
        
    return {
        'chunk': encoded_chunks,
        'chunk_index': index,
        'total_images': total_images,
        'total_chunks': total_chunks,
        'key_points': expansion_key_points,
    }


