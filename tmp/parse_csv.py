import csv

def parse_csv(file_path):
    result = {}
    with open(file_path, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)
        for row in reader:
            if len(row) >= 2:
                key = row[1]
                value = row[0]
                msg = row[2] if len(row) == 3 else None
                result[key] = {
                    'value': value,
                    'msg': msg
                }
    return result

if __name__ == '__main__':
    file_path = 'links.csv'
    parsed_data = parse_csv(file_path)
    
    for key, value in parsed_data.items():
        print(f'{key}: {value}')
        print('--------------------')